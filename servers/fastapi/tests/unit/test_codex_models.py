from constants.llm import DEFAULT_CODEX_MODEL, SUPPORTED_CODEX_MODELS
from enums.llm_provider import LLMProvider
from utils import llm_provider


def test_codex_supported_model_is_preserved(monkeypatch):
    monkeypatch.setattr(llm_provider, "get_llm_provider", lambda: LLMProvider.CODEX)
    monkeypatch.setattr(llm_provider, "get_codex_model_env", lambda: "gpt-5.4-mini")

    assert llm_provider.get_model() == "gpt-5.4-mini"


def test_codex_deprecated_model_falls_back_to_default(monkeypatch):
    monkeypatch.setattr(llm_provider, "get_llm_provider", lambda: LLMProvider.CODEX)
    monkeypatch.setattr(llm_provider, "get_codex_model_env", lambda: "gpt-5.2")

    assert DEFAULT_CODEX_MODEL == "gpt-5.5"
    assert "gpt-5.2" not in SUPPORTED_CODEX_MODELS
    assert llm_provider.get_model() == DEFAULT_CODEX_MODEL
