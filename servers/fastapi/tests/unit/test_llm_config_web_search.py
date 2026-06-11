from llmai.shared import OpenAIApiType

from utils.llm_config import get_llm_config


def test_openai_uses_responses_api_only_for_native_web_search(monkeypatch):
    monkeypatch.setenv("LLM", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    regular_config = get_llm_config()
    search_config = get_llm_config(use_openai_responses_api=True)

    assert regular_config.api_type == OpenAIApiType.COMPLETIONS
    assert search_config.api_type == OpenAIApiType.RESPONSES
