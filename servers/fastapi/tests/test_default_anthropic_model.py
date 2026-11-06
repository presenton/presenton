import pytest

from constants.llm import DEFAULT_ANTHROPIC_MODEL
from utils.llm_provider import get_model

# Claude models Anthropic has already retired; requests naming them fail.
RETIRED_ANTHROPIC_MODELS = {
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514",
    "claude-3-7-sonnet-20250219",
    "claude-3-5-haiku-20241022",
}


def test_default_anthropic_model_is_not_retired():
    assert DEFAULT_ANTHROPIC_MODEL not in RETIRED_ANTHROPIC_MODELS


def test_get_model_without_anthropic_model_env_uses_a_current_default(monkeypatch):
    monkeypatch.setenv("LLM", "anthropic")
    monkeypatch.delenv("ANTHROPIC_MODEL", raising=False)

    assert get_model() == DEFAULT_ANTHROPIC_MODEL
    assert get_model() not in RETIRED_ANTHROPIC_MODELS


def test_get_model_prefers_anthropic_model_env(monkeypatch):
    monkeypatch.setenv("LLM", "anthropic")
    monkeypatch.setenv("ANTHROPIC_MODEL", "claude-haiku-4-5")

    assert get_model() == "claude-haiku-4-5"
