import asyncio

import pytest

from utils.model_availability import check_llm_and_image_provider_api_or_model_availability


def _set_litellm_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CAN_CHANGE_KEYS", "false")
    monkeypatch.setenv("LLM", "litellm")
    monkeypatch.setenv("LITELLM_BASE_URL", "http://localhost:4000")
    monkeypatch.setenv("LITELLM_MODEL", "test-model")


def test_skips_image_provider_when_generation_disabled(monkeypatch):
    _set_litellm_env(monkeypatch)
    monkeypatch.setenv("DISABLE_IMAGE_GENERATION", "true")
    monkeypatch.delenv("IMAGE_PROVIDER", raising=False)

    asyncio.run(check_llm_and_image_provider_api_or_model_availability())


def test_skips_invalid_image_provider_when_generation_disabled(monkeypatch):
    _set_litellm_env(monkeypatch)
    monkeypatch.setenv("DISABLE_IMAGE_GENERATION", "true")
    monkeypatch.setenv("IMAGE_PROVIDER", "not-a-real-provider")

    asyncio.run(check_llm_and_image_provider_api_or_model_availability())


def test_requires_image_provider_when_generation_enabled(monkeypatch):
    _set_litellm_env(monkeypatch)
    monkeypatch.delenv("DISABLE_IMAGE_GENERATION", raising=False)
    monkeypatch.delenv("IMAGE_PROVIDER", raising=False)

    with pytest.raises(Exception, match="IMAGE_PROVIDER must be provided"):
        asyncio.run(check_llm_and_image_provider_api_or_model_availability())
