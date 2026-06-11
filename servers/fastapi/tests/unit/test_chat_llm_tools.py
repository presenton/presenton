import pytest
from llmai.shared import Tool, WebSearchTool  # type: ignore[import-not-found]
from unittest.mock import Mock

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
    "provider",
    [LLMProvider.GOOGLE, LLMProvider.VERTEX],
)
def test_build_chat_llm_tools_omits_web_search_for_gemini_providers(monkeypatch, provider):
    monkeypatch.setenv("LLM", provider.value)
    tools = build_chat_llm_tools(_sample_function_tools())

    assert len(tools) == 1
    assert isinstance(tools[0], Tool)
    assert not any(isinstance(tool, WebSearchTool) for tool in tools)


@pytest.mark.parametrize(
    "provider",
    [LLMProvider.OPENAI, LLMProvider.ANTHROPIC],
)
def test_build_chat_llm_tools_includes_web_search_for_other_providers(monkeypatch, provider):
    monkeypatch.setenv("LLM", provider.value)
    tools = build_chat_llm_tools(_sample_function_tools())

    assert len(tools) == 2
    assert isinstance(tools[-1], WebSearchTool)


def test_build_chat_llm_tools_omits_hosted_search_for_external_provider(monkeypatch):
    monkeypatch.setenv("LLM", LLMProvider.CUSTOM.value)
    monkeypatch.setenv("WEB_SEARCH_PROVIDER", "searxng")

    tools = build_chat_llm_tools(_sample_function_tools())

    assert len(tools) == 1
    assert not any(isinstance(tool, WebSearchTool) for tool in tools)


def test_chat_does_not_expose_external_search_for_google_auto_mode(monkeypatch):
    monkeypatch.setenv("LLM", LLMProvider.GOOGLE.value)
    monkeypatch.setenv("WEB_SEARCH_PROVIDER", "auto")
    monkeypatch.setenv("SEARXNG_BASE_URL", "http://127.0.0.1:8080")

    tools = ChatTools(Mock()).get_tool_definitions()

    assert not any(tool.name == "webSearch" for tool in tools)
