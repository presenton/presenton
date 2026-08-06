import pytest
from fastapi import HTTPException
from llmai.shared import OpenAIClientConfig

from constants.llm import DEFAULT_ORCAROUTER_MODEL
from enums.llm_provider import LLMProvider
from models.user_config import UserConfig
from utils.llm_config import get_llm_config
from utils.llm_provider import (
    get_llm_provider,
    get_model,
    is_openrouter_selected,
    is_orcarouter_selected,
)
from utils import user_config as user_config_utils
from utils.user_config import update_env_with_user_config


@pytest.fixture(autouse=True)
def _clear_orcarouter_env(monkeypatch):
    for name in ("ORCAROUTER_API_KEY", "ORCAROUTER_MODEL", "ORCAROUTER_BASE_URL"):
        monkeypatch.delenv(name, raising=False)


def test_orcarouter_is_a_selectable_provider(monkeypatch):
    monkeypatch.setenv("LLM", "orcarouter")

    assert get_llm_provider() == LLMProvider.ORCAROUTER
    assert is_orcarouter_selected() is True
    # must not be confused with the similarly named OpenRouter provider
    assert is_openrouter_selected() is False


def test_orcarouter_uses_openai_client_config_with_gateway_base_url(monkeypatch):
    monkeypatch.setenv("LLM", "orcarouter")
    monkeypatch.setenv("ORCAROUTER_API_KEY", "sk-orca-test")

    config = get_llm_config()

    assert isinstance(config, OpenAIClientConfig)
    assert config.api_key == "sk-orca-test"
    assert config.base_url == "https://api.orcarouter.ai/v1"


def test_orcarouter_base_url_override_is_normalized(monkeypatch):
    monkeypatch.setenv("LLM", "orcarouter")
    monkeypatch.setenv("ORCAROUTER_API_KEY", "sk-orca-test")
    monkeypatch.setenv("ORCAROUTER_BASE_URL", "https://gateway.example.com")

    assert get_llm_config().base_url == "https://gateway.example.com/v1"


def test_orcarouter_without_api_key_raises_clear_400(monkeypatch):
    monkeypatch.setenv("LLM", "orcarouter")

    with pytest.raises(HTTPException) as excinfo:
        get_llm_config()

    assert excinfo.value.status_code == 400
    assert excinfo.value.detail == "OrcaRouter API Key is not set"


def test_orcarouter_model_defaults_and_env_override(monkeypatch):
    monkeypatch.setenv("LLM", "orcarouter")
    monkeypatch.setenv("ORCAROUTER_API_KEY", "sk-orca-test")

    assert get_model() == DEFAULT_ORCAROUTER_MODEL

    monkeypatch.setenv("ORCAROUTER_MODEL", "anthropic/claude-sonnet-5")
    assert get_model() == "anthropic/claude-sonnet-5"


def test_orcarouter_default_model_is_pinned_not_the_auto_router():
    # Presentation generation depends on strict json_schema structured output,
    # which the "orcarouter/auto" router does not guarantee because it may pick
    # an upstream that ignores the schema.
    assert DEFAULT_ORCAROUTER_MODEL != "orcarouter/auto"


def test_user_config_exports_orcarouter_settings_to_env(monkeypatch):
    stored = UserConfig(
        LLM="orcarouter",
        ORCAROUTER_API_KEY="sk-orca-stored",
        ORCAROUTER_MODEL="openai/gpt-5.5",
        ORCAROUTER_BASE_URL="https://api.orcarouter.ai/v1",
    )
    monkeypatch.setattr(user_config_utils, "get_user_config", lambda: stored)

    update_env_with_user_config()

    config = get_llm_config()
    assert config.api_key == "sk-orca-stored"
    assert config.base_url == "https://api.orcarouter.ai/v1"
    assert get_model() == "openai/gpt-5.5"
