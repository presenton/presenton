import pytest

from fastapi import HTTPException
from enums.llm_provider import LLMProvider
from utils import llm_provider


@pytest.mark.parametrize(
    "model",
    ["gpt-5.6-luna", "future-account-model", "vendor/new-model"],
)
def test_codex_exact_model_is_preserved_without_discovery(monkeypatch, model):
    monkeypatch.setattr(llm_provider, "get_llm_provider", lambda: LLMProvider.CODEX)
    monkeypatch.setattr(llm_provider, "get_codex_model_env", lambda: model)

    assert llm_provider.get_model() == model


@pytest.mark.parametrize("model", [None, "", "  "])
def test_codex_requires_an_explicit_model_instead_of_silent_fallback(
    monkeypatch, model
):
    monkeypatch.setattr(llm_provider, "get_llm_provider", lambda: LLMProvider.CODEX)
    monkeypatch.setattr(llm_provider, "get_codex_model_env", lambda: model)

    with pytest.raises(HTTPException) as error:
        llm_provider.get_model()
    assert error.value.status_code == 400
