from unittest.mock import Mock

import pytest
from llmai.shared import Tool  # type: ignore[import-not-found]

from enums.llm_provider import LLMProvider
from services.chat.llm_tools import build_chat_llm_tools
from services.chat.tools import ChatTools


def _sample_function_tools() -> list[Tool]:
    return [
        Tool(
            name="getSlideAtIndex",
            description="Read a slide",
            input_schema={"type": "object", "properties": {}},
        )
    ]


@pytest.mark.parametrize(
    ("provider", "web_search_provider"),
    [
        (LLMProvider.OPENAI, "auto"),
        (LLMProvider.OPENAI, "native"),
        (LLMProvider.ANTHROPIC, "auto"),
        (LLMProvider.GOOGLE, "auto"),
        (LLMProvider.VERTEX, "auto"),
        (LLMProvider.CUSTOM, "searxng"),
    ],
)
def test_build_chat_llm_tools_returns_only_function_tools(
    monkeypatch,
    provider,
    web_search_provider,
):
    monkeypatch.setenv("LLM", provider.value)
    monkeypatch.setenv("WEB_SEARCH_PROVIDER", web_search_provider)
    function_tools = _sample_function_tools()

    tools = build_chat_llm_tools(function_tools)

    assert len(tools) == 1
    assert tools[0].name == "getSlideAtIndex"


@pytest.mark.parametrize(
    ("provider", "web_search_provider"),
    [
        (LLMProvider.OPENAI, "auto"),
        (LLMProvider.OPENAI, "native"),
        (LLMProvider.CUSTOM, "searxng"),
        (LLMProvider.GOOGLE, "auto"),
    ],
)
def test_chat_tool_definitions_do_not_expose_web_search(
    monkeypatch,
    provider,
    web_search_provider,
):
    monkeypatch.setenv("LLM", provider.value)
    monkeypatch.setenv("WEB_SEARCH_PROVIDER", web_search_provider)
    monkeypatch.setenv("SEARXNG_BASE_URL", "http://127.0.0.1:8080")

    tools = ChatTools(Mock()).get_tool_definitions()

    assert not any(tool.name == "webSearch" for tool in tools)


def test_chat_tool_handler_rejects_web_search():
    chat_tools = ChatTools(Mock())

    assert "webSearch" not in chat_tools._tool_handlers
