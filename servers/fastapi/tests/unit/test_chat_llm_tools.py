from unittest.mock import Mock

import pytest
from llmai.openai.client import OpenAIClient  # type: ignore[import-not-found]
from llmai.shared.configs import OpenAIClientConfig  # type: ignore[import-not-found]
from llmai.shared.schema import get_schema_as_dict  # type: ignore[import-not-found]
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


def test_chat_tool_parse_args_repairs_fenced_jsonish_payload():
    assert ChatTools._parse_args(
        "```json\n{index: 0, includeFullContent: true}\n```"
    ) == {"index": 0, "includeFullContent": True}


def test_chat_tools_expose_only_v2_tool_names():
    assert [tool.name for tool in ChatTools(Mock()).get_tool_definitions()] == [
        "addOutline",
        "updateOutline",
        "deleteOutline",
        "addNewSlide",
        "addNewSlideLayout",
        "getAvailableLayouts",
        "getAvailableBlocks",
        "getContentSchemaFromLayoutId",
        "getTemplateSummary",
        "readSourceDocuments",
        "searchSlide",
        "getSlideAtIndex",
        "saveSlide",
        "updateSlide",
        "deleteSlide",
        "addElement",
        "updateElement",
        "deleteElement",
        "addComponent",
        "createComponent",
        "updateComponent",
        "deleteComponent",
        "getPresentationTheme",
        "setPresentationTheme",
        "generateAssets",
    ]


def test_chat_tools_emit_openai_strict_compatible_schemas():
    client = OpenAIClient(config=OpenAIClientConfig(api_key="test"))
    tools = ChatTools(Mock()).get_tool_definitions()

    for tool in tools:
        schema = client._openai_schema(
            get_schema_as_dict(tool.input_schema, strict=tool.strict),
            strict=tool.strict,
        )
        _assert_openai_strict_schema(schema, tool.name)


def _assert_openai_strict_schema(node, tool_name: str):
    if isinstance(node, list):
        for item in node:
            _assert_openai_strict_schema(item, tool_name)
        return

    if not isinstance(node, dict):
        return

    if node.get("type") == "array":
        assert node.get("items") not in (None, {}), tool_name

    if node.get("type") == "object" and isinstance(node.get("properties"), dict):
        properties = set(node["properties"])
        assert set(node.get("required") or []) == properties, tool_name
        assert node.get("additionalProperties") is False, tool_name

    for variant in node.get("anyOf") or []:
        if isinstance(variant, dict):
            assert "type" in variant or "$ref" in variant, tool_name

    for value in node.values():
        _assert_openai_strict_schema(value, tool_name)
