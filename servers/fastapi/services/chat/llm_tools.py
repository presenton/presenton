import logging

from llmai.shared import Tool, WebSearchTool  # type: ignore[import-not-found]

from enums.llm_provider import LLMProvider
from utils.llm_provider import get_llm_provider
from utils.web_search import (
    get_selected_web_search_provider,
    should_use_native_web_search,
)

LOGGER = logging.getLogger(__name__)

# Gemini (Google AI + Vertex) does not allow Search and Function tools in one request.
_GEMINI_EXCLUSIVE_TOOL_PROVIDERS = frozenset(
    {
        LLMProvider.GOOGLE,
        LLMProvider.VERTEX,
    }
)


def build_chat_llm_tools(function_tools: list[Tool]) -> list[Tool | WebSearchTool]:
    """
    Chat needs slide-edit function tools on every provider. Hosted web search is
    appended only when the active provider can combine it with function tools.
    """
    tools: list[Tool | WebSearchTool] = list(function_tools)
    if (
        should_use_native_web_search()
        and get_llm_provider() not in _GEMINI_EXCLUSIVE_TOOL_PROVIDERS
    ):
        tools.append(WebSearchTool())
        LOGGER.info(
            "Chat web search routing: mode=native selected_provider=%s llm_provider=%s",
            get_selected_web_search_provider().value,
            get_llm_provider().value,
        )
    return tools
