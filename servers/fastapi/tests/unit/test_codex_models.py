import pytest

from constants.llm import DEFAULT_CODEX_MODEL, SUPPORTED_CODEX_MODELS
from enums.llm_provider import LLMProvider
from utils import llm_provider


@pytest.mark.parametrize(
    "model",
    ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"],
)
def test_codex_gpt_5_6_model_is_preserved(monkeypatch, model):
    monkeypatch.setattr(llm_provider, "get_llm_provider", lambda: LLMProvider.CODEX)
    monkeypatch.setattr(llm_provider, "get_codex_model_env", lambda: model)

    assert model in SUPPORTED_CODEX_MODELS
    assert llm_provider.get_model() == model


@pytest.mark.parametrize("model", ["gpt-5.6", "gpt-5.2"])
def test_codex_unsupported_model_falls_back_to_lowest_gpt_5_6_model(
    monkeypatch, model
):
    monkeypatch.setattr(llm_provider, "get_llm_provider", lambda: LLMProvider.CODEX)
    monkeypatch.setattr(llm_provider, "get_codex_model_env", lambda: model)

    assert DEFAULT_CODEX_MODEL == "gpt-5.6-luna"
    assert model not in SUPPORTED_CODEX_MODELS
    assert llm_provider.get_model() == DEFAULT_CODEX_MODEL
