import asyncio
import json
from typing import Any
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from llmai.shared import WebSearchTool
from pydantic import ValidationError

from enums.web_search_provider import WebSearchProvider
from models.presentation_outline_model import PresentationOutlineModel
from tests.mocks.llm import content_event
from utils.llm_calls import generate_presentation_outlines as outline_module


def _collect_async_chunks(generator) -> list[Any]:
    async def _collect():
        chunks = []
        async for chunk in generator:
            chunks.append(chunk)
        return chunks

    return asyncio.run(_collect())


def test_get_user_prompt_uses_autodetect_defaults():
    prompt = outline_module.get_user_prompt(
        content="Build quarterly strategy deck",
        n_slides=None,
        language="  ",
        additional_context=None,
        tone="professional",
        instructions=None,
    )

    assert "Number of Slides: auto-detect" in prompt
    assert "Language: auto-detect" in prompt
    assert "Tone: professional" in prompt
    assert "Context: None" in prompt


def test_system_prompt_forbids_sources_in_outlines():
    prompt = outline_module.get_system_prompt()

    assert "Do not include URLs" in prompt
    assert "without mentioning sources" in prompt
    assert "Give each slide one clear purpose" in prompt
    assert "Vary content structures where appropriate" in prompt


def test_generate_ppt_outline_default_openai_uses_native_search_tool(monkeypatch):
    captured_kwargs = {}
    captured_config_kwargs = {}

    async def fake_stream_generate_events(_client, **kwargs):
        captured_kwargs.update(kwargs)
        yield content_event('{"slides": [{"content": "## Current facts"}]}')

    def fake_get_llm_config(**kwargs):
        captured_config_kwargs.update(kwargs)
        return {}

    monkeypatch.setenv("LLM", "openai")
    monkeypatch.setenv("WEB_SEARCH_PROVIDER", "auto")

    with patch.object(outline_module, "get_model", return_value="fake-model"), patch.object(
        outline_module, "get_client", return_value=object()
    ), patch.object(
        outline_module,
        "get_llm_config",
        side_effect=fake_get_llm_config,
    ), patch.object(
        outline_module,
        "get_generate_kwargs",
        side_effect=lambda **kwargs: kwargs,
    ), patch.object(
        outline_module, "stream_generate_events", side_effect=fake_stream_generate_events
    ):
        _collect_async_chunks(
            outline_module.generate_ppt_outline(
                content="Who is the current PM of Nepal?",
                n_slides=1,
                language="English",
                web_search=True,
            )
        )

    assert captured_config_kwargs == {"use_openai_responses_api": True}
    assert len(captured_kwargs["tools"]) == 1
    assert isinstance(captured_kwargs["tools"][0], WebSearchTool)


def test_generate_ppt_outline_streams_json_chunks_and_keeps_schema_shape():
    async def fake_stream_generate_events(_client, **_kwargs):
        yield content_event('{"slides": [')
        yield content_event('{"content": "## Intro\\nBullet"}')
        yield content_event("]}")

    with patch.object(outline_module, "get_model", return_value="fake-model"), patch.object(
        outline_module, "get_client", return_value=object()
    ), patch.object(outline_module, "get_llm_config", return_value={}), patch.object(
        outline_module,
        "get_generate_kwargs",
        side_effect=lambda **kwargs: kwargs,
    ), patch.object(
        outline_module, "stream_generate_events", side_effect=fake_stream_generate_events
    ):
        chunks = _collect_async_chunks(
            outline_module.generate_ppt_outline(
                content="topic",
                n_slides=1,
                language="English",
            )
        )

    parsed = json.loads("".join(chunks))
    validated = PresentationOutlineModel.model_validate(parsed)
    assert len(validated.slides) == 1
    assert validated.slides[0].content.startswith("## Intro")


def test_generate_ppt_outline_returns_http_exception_chunk_on_failure():
    async def failing_stream(_client, **_kwargs):
        raise TimeoutError("provider timed out")
        yield  # pragma: no cover

    with patch.object(outline_module, "get_model", return_value="fake-model"), patch.object(
        outline_module, "get_client", return_value=object()
    ), patch.object(
        outline_module,
        "get_llm_config",
        return_value={},
    ), patch.object(
        outline_module,
        "get_generate_kwargs",
        side_effect=lambda **kwargs: kwargs,
    ), patch.object(
        outline_module,
        "stream_generate_events",
        side_effect=failing_stream,
    ), patch.object(
        outline_module,
        "handle_llm_client_exceptions",
        return_value=HTTPException(status_code=408, detail="LLM timeout"),
    ):
        chunks = _collect_async_chunks(
            outline_module.generate_ppt_outline(
                content="topic",
                n_slides=1,
                language="English",
            )
        )

    assert len(chunks) == 1
    assert isinstance(chunks[0], HTTPException)
    assert chunks[0].status_code == 408


def test_generate_ppt_outline_injects_external_search_context_without_hosted_tool():
    captured_kwargs = {}

    async def fake_stream_generate_events(_client, **kwargs):
        captured_kwargs.update(kwargs)
        yield content_event('{"slides": [{"content": "## Current facts"}]}')

    with patch.object(outline_module, "get_model", return_value="fake-model"), patch.object(
        outline_module, "get_client", return_value=object()
    ), patch.object(outline_module, "get_llm_config", return_value={}), patch.object(
        outline_module, "should_use_native_web_search", return_value=False
    ), patch.object(
        outline_module, "should_expose_external_web_search_tool", return_value=True
    ), patch.object(
        outline_module,
        "generate_web_search_query",
        return_value="latest current market facts",
    ), patch.object(
        outline_module,
        "get_web_search_context",
        return_value="Web search results:\nSummary: Current market facts",
    ), patch.object(
        outline_module,
        "get_generate_kwargs",
        side_effect=lambda **kwargs: kwargs,
    ), patch.object(
        outline_module, "stream_generate_events", side_effect=fake_stream_generate_events
    ):
        _collect_async_chunks(
            outline_module.generate_ppt_outline(
                content="current market",
                n_slides=1,
                language="English",
                web_search=True,
            )
        )

    assert captured_kwargs["tools"] is None
    assert "Current market facts" in str(captured_kwargs["messages"][1].content)
    assert "URL:" not in str(captured_kwargs["messages"][1].content)


def test_generate_ppt_outline_emits_provider_aware_external_search_statuses():
    async def fake_stream_generate_events(_client, **_kwargs):
        yield content_event('{"slides": [{"content": "## Current facts"}]}')

    with patch.object(outline_module, "get_model", return_value="fake-model"), patch.object(
        outline_module, "get_client", return_value=object()
    ), patch.object(outline_module, "get_llm_config", return_value={}), patch.object(
        outline_module, "should_use_native_web_search", return_value=False
    ), patch.object(
        outline_module, "should_expose_external_web_search_tool", return_value=True
    ), patch.object(
        outline_module,
        "get_web_search_route",
        return_value=("external", WebSearchProvider.SEARXNG),
    ), patch.object(
        outline_module, "generate_web_search_query", return_value="current Nepal PM"
    ), patch.object(
        outline_module, "get_web_search_context", return_value="Current facts"
    ), patch.object(
        outline_module, "get_generate_kwargs", side_effect=lambda **kwargs: kwargs
    ), patch.object(
        outline_module, "stream_generate_events", side_effect=fake_stream_generate_events
    ):
        chunks = _collect_async_chunks(
            outline_module.generate_ppt_outline(
                content="Who is the current PM of Nepal?",
                n_slides=1,
                language="English",
                web_search=True,
                emit_statuses=True,
            )
        )

    statuses = [
        chunk.message
        for chunk in chunks
        if isinstance(chunk, outline_module.OutlineGenerationStatus)
    ]
    assert statuses == [
        "Analyzing your topic for web research",
        "Searching with SearXNG: current Nepal PM",
        "Web research complete",
        "Drafting your presentation outline",
    ]


def test_generate_ppt_outline_emits_model_native_search_status():
    async def fake_stream_generate_events(_client, **_kwargs):
        yield content_event('{"slides": [{"content": "## Current facts"}]}')

    with patch.object(outline_module, "get_model", return_value="fake-model"), patch.object(
        outline_module, "get_client", return_value=object()
    ), patch.object(outline_module, "get_llm_config", return_value={}), patch.object(
        outline_module, "should_use_native_web_search", return_value=True
    ), patch.object(
        outline_module, "should_expose_external_web_search_tool", return_value=False
    ), patch.object(
        outline_module, "get_generate_kwargs", side_effect=lambda **kwargs: kwargs
    ), patch.object(
        outline_module, "stream_generate_events", side_effect=fake_stream_generate_events
    ):
        chunks = _collect_async_chunks(
            outline_module.generate_ppt_outline(
                content="Current facts",
                n_slides=1,
                language="English",
                web_search=True,
                emit_statuses=True,
            )
        )

    statuses = [
        chunk.message
        for chunk in chunks
        if isinstance(chunk, outline_module.OutlineGenerationStatus)
    ]
    assert statuses == [
        "Searching with model-native web search and drafting outlines"
    ]


def test_generate_ppt_outline_uses_fallback_query_when_query_generation_fails():
    searched_queries = []

    async def fake_stream_generate_events(_client, **_kwargs):
        yield content_event('{"slides": [{"content": "## Current facts"}]}')

    async def fail_query_generation(*_args):
        raise RuntimeError("local model cannot generate structured query")

    async def capture_search_context(query):
        searched_queries.append(query)
        return ""

    with patch.object(outline_module, "get_model", return_value="fake-model"), patch.object(
        outline_module, "get_client", return_value=object()
    ), patch.object(outline_module, "get_llm_config", return_value={}), patch.object(
        outline_module, "should_use_native_web_search", return_value=False
    ), patch.object(
        outline_module, "should_expose_external_web_search_tool", return_value=True
    ), patch.object(
        outline_module,
        "generate_web_search_query",
        side_effect=fail_query_generation,
    ), patch.object(
        outline_module,
        "get_web_search_context",
        side_effect=capture_search_context,
    ), patch.object(
        outline_module,
        "get_generate_kwargs",
        side_effect=lambda **kwargs: kwargs,
    ), patch.object(
        outline_module, "stream_generate_events", side_effect=fake_stream_generate_events
    ):
        _collect_async_chunks(
            outline_module.generate_ppt_outline(
                content="current market",
                n_slides=1,
                language="English",
                instructions="focus on Nepal",
                web_search=True,
            )
        )

    assert searched_queries == ["current market focus on Nepal"]


def test_generate_ppt_outline_uses_fallback_query_when_generated_query_is_null():
    searched_queries = []

    async def fake_stream_generate_events(_client, **_kwargs):
        yield content_event('{"slides": [{"content": "## Supplied facts"}]}')

    async def capture_search_context(query):
        searched_queries.append(query)
        return ""

    with patch.object(outline_module, "get_model", return_value="fake-model"), patch.object(
        outline_module, "get_client", return_value=object()
    ), patch.object(outline_module, "get_llm_config", return_value={}), patch.object(
        outline_module, "should_use_native_web_search", return_value=False
    ), patch.object(
        outline_module, "should_expose_external_web_search_tool", return_value=True
    ), patch.object(
        outline_module,
        "generate_web_search_query",
        return_value=None,
    ), patch.object(
        outline_module,
        "get_web_search_context",
        side_effect=capture_search_context,
    ), patch.object(
        outline_module,
        "get_generate_kwargs",
        side_effect=lambda **kwargs: kwargs,
    ), patch.object(
        outline_module, "stream_generate_events", side_effect=fake_stream_generate_events
    ):
        _collect_async_chunks(
            outline_module.generate_ppt_outline(
                content="complete supplied report",
                n_slides=1,
                language="English",
                web_search=True,
            )
        )

    assert searched_queries == ["complete supplied report"]


def test_presentation_outline_model_schema_validation_rejects_invalid_ai_payload():
    invalid_payload = {"slides": [{"not_content": "missing expected key"}]}

    with pytest.raises(ValidationError):
        PresentationOutlineModel.model_validate(invalid_payload)
