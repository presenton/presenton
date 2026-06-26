from llmai.shared import Tool  # type: ignore[import-not-found]


def build_chat_llm_tools(function_tools: list[Tool]) -> list[Tool]:
    """
    Chat needs only slide-edit function tools. Web search is intentionally
    disabled for the assistant chat even when global web grounding is enabled.
    """
    return list(function_tools)
