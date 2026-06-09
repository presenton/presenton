"""
Server-side web grounding for local LLM pipelines.

Flow:
  1. extract_search_queries()  — low-temp LLM call → 2-3 search strings
  2. execute_web_search()       — Tavily (if TAVILY_API_KEY set) else DuckDuckGo
  3. build_search_context()     — orchestrates 1+2, returns a Markdown block
                                   ready to inject into any system prompt

All failures are non-fatal: a warning is logged and None is returned so
callers can fall back to standard generation without a crash.
"""

import asyncio
import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal: single-query search backends
# ---------------------------------------------------------------------------

async def _ddg_search(query: str, max_results: int) -> list[dict]:
    """DuckDuckGo search wrapped in a thread (sync client, avoids blocking)."""
    def _sync() -> list[dict]:
        try:
            from duckduckgo_search import DDGS
            with DDGS() as ddgs:
                return list(ddgs.text(query, max_results=max_results))
        except Exception as exc:
            logger.warning("[web_search] DuckDuckGo failed for %r: %s", query, exc)
            return []
    return await asyncio.to_thread(_sync)


async def _tavily_search(query: str, max_results: int, api_key: str) -> list[dict]:
    """Tavily search wrapped in a thread."""
    def _sync() -> list[dict]:
        try:
            from tavily import TavilyClient
            client = TavilyClient(api_key=api_key)
            response = client.search(query, max_results=max_results)
            return [
                {
                    "title": r.get("title", ""),
                    "body": r.get("content", ""),
                    "href": r.get("url", ""),
                }
                for r in response.get("results", [])
            ]
        except Exception as exc:
            logger.warning("[web_search] Tavily failed for %r: %s", query, exc)
            return []
    return await asyncio.to_thread(_sync)


async def _search_one(query: str, max_results: int) -> list[dict]:
    """Try Tavily first; fall back to DuckDuckGo."""
    tavily_key = os.getenv("TAVILY_API_KEY", "").strip()
    if tavily_key:
        results = await _tavily_search(query, max_results, tavily_key)
        if results:
            return results
    return await _ddg_search(query, max_results)


def _format_results(query: str, results: list[dict]) -> str:
    if not results:
        return ""
    lines = [f"### Search: {query}"]
    for r in results:
        title = r.get("title") or ""
        body = r.get("body") or r.get("snippet") or r.get("content") or ""
        url = r.get("href") or r.get("url") or ""
        if title:
            lines.append(f"**{title}**")
        if body:
            lines.append(body.strip())
        if url:
            lines.append(f"Source: {url}")
        lines.append("")
    return "\n".join(lines).rstrip()


# ---------------------------------------------------------------------------
# Public: single-query entry point
# ---------------------------------------------------------------------------

async def execute_web_search(query: str, max_results: int = 5) -> str:
    """Run a single search and return formatted Markdown. Returns '' on failure."""
    try:
        results = await _search_one(query, max_results)
        return _format_results(query, results)
    except Exception as exc:
        logger.warning("[web_search] execute_web_search failed: %s", exc)
        return ""


# ---------------------------------------------------------------------------
# Query extraction: lightweight LLM call
# ---------------------------------------------------------------------------

async def extract_search_queries(content: str) -> list[str]:
    """
    Ask the configured LLM to derive 2-3 search queries from the presentation topic.
    Uses temperature=0.0 and re-uses the existing LLM config — no new model added.
    Returns [] on any failure.
    """
    try:
        import asyncio as _asyncio
        from llmai import get_client
        from llmai.shared import SystemMessage, UserMessage
        from utils.llm_config import get_llm_config
        from utils.llm_provider import get_model
        from utils.llm_utils import get_generate_kwargs

        client = get_client(config=get_llm_config())
        model = get_model()
        messages = [
            SystemMessage(content=(
                "You are a search query generator. "
                "Output ONLY a JSON array of 2-3 short search engine queries. "
                "No explanation, no markdown fences — just the raw JSON array. "
                'Example: ["query one", "query two", "query three"]'
            )),
            UserMessage(content=(
                f"Presentation topic:\n{content[:800]}\n\n"
                "Generate 2-3 search queries to find current facts, statistics, "
                "and recent developments relevant to this topic."
            )),
        ]
        kwargs = get_generate_kwargs(model=model, messages=messages, temperature=0.0)
        raw = await _asyncio.to_thread(client.generate, **kwargs)

        text: str = raw if isinstance(raw, str) else (
            raw.content if hasattr(raw, "content") else str(raw)
        )
        start = text.find("[")
        end = text.rfind("]") + 1
        if start != -1 and end > start:
            queries = json.loads(text[start:end])
            if isinstance(queries, list):
                cleaned = [str(q).strip() for q in queries if str(q).strip()]
                logger.info("[web_search] Extracted queries: %s", cleaned)
                return cleaned[:3]
    except Exception as exc:
        logger.warning("[web_search] Query extraction failed: %s", exc)
    return []


# ---------------------------------------------------------------------------
# Main entry point: build full grounding context
# ---------------------------------------------------------------------------

async def build_search_context(content: str, web_search: bool) -> Optional[str]:
    """
    Orchestrates query extraction + search and returns a Markdown block
    ready to prepend to any LLM system prompt.

    Returns None if:
    - web_search is False
    - query extraction yields nothing
    - all search calls fail

    Never raises — callers always get None on failure.
    """
    if not web_search:
        return None

    try:
        queries = await extract_search_queries(content)
        if not queries:
            logger.warning("[web_search] No queries extracted — skipping grounding")
            return None

        sections: list[str] = []
        for query in queries:
            section = await execute_web_search(query, max_results=5)
            if section:
                sections.append(section)

        if not sections:
            logger.warning("[web_search] All searches returned empty results — skipping grounding")
            return None

        body = "\n\n".join(sections)
        header = (
            "# Web Search Grounding\n"
            "The following results were retrieved from live web searches. "
            "Use them to ground the presentation with current facts, figures, "
            "and sources. Prefer these over training-data knowledge where they conflict.\n\n"
        )
        logger.info(
            "[web_search] Grounding context built (%d chars, %d sections)",
            len(body),
            len(sections),
        )
        return header + body

    except Exception as exc:
        logger.warning(
            "[web_search] build_search_context failed: %s — continuing without grounding", exc
        )
        return None
