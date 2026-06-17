import asyncio
from types import SimpleNamespace

from utils.llm_calls.generate_web_search_query import generate_web_search_query


class FakeClient:
    def __init__(self, content):
        self.content = content
        self.calls = []

    def generate(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(content=self.content)


def test_generate_web_search_query_returns_normalized_query(monkeypatch):
    monkeypatch.setenv("LLM", "ollama")
    client = FakeClient({"query": "  latest   Nepal economy statistics 2026  "})

    query = asyncio.run(
        generate_web_search_query(
            client,
            "fake-model",
            "Create a presentation about Nepal's economy",
            "Use current statistics",
        )
    )

    assert query == "latest Nepal economy statistics 2026"
    assert client.calls[0]["response_format"].name == "web_search_query"
    assert "TODAY'S DATE:" in str(client.calls[0]["messages"][1].content)


def test_generate_web_search_query_returns_none_for_invalid_empty_result(monkeypatch):
    monkeypatch.setenv("LLM", "ollama")
    client = FakeClient({"query": None})

    query = asyncio.run(
        generate_web_search_query(
            client,
            "fake-model",
            "A complete supplied factual report",
        )
    )

    assert query is None
