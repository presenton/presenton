import asyncio

import pytest

from models.ollama_model_status import OllamaModelStatus
from utils import model_availability
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


def test_ollama_requires_selected_model_to_already_be_available(monkeypatch):
    monkeypatch.setenv("CAN_CHANGE_KEYS", "false")
    monkeypatch.setenv("LLM", "ollama")
    monkeypatch.setenv("OLLAMA_MODEL", "llama3:8b")
    monkeypatch.setenv("DISABLE_IMAGE_GENERATION", "true")

    async def list_models():
        return []

    monkeypatch.setattr(model_availability, "list_available_ollama_models", list_models)

    with pytest.raises(Exception, match="not available in Ollama"):
        asyncio.run(check_llm_and_image_provider_api_or_model_availability())


def test_ollama_accepts_selected_available_model(monkeypatch):
    monkeypatch.setenv("CAN_CHANGE_KEYS", "false")
    monkeypatch.setenv("LLM", "ollama")
    monkeypatch.setenv("OLLAMA_MODEL", "llama3:8b")
    monkeypatch.setenv("DISABLE_IMAGE_GENERATION", "true")

    async def list_models():
        return [
            OllamaModelStatus(
                name="llama3:8b",
                size=1,
                downloaded=1,
                status="pulled",
                done=True,
            )
        ]

    monkeypatch.setattr(model_availability, "list_available_ollama_models", list_models)

    asyncio.run(check_llm_and_image_provider_api_or_model_availability())


def test_ollama_accepts_selected_available_experimental_model(monkeypatch):
    monkeypatch.setenv("CAN_CHANGE_KEYS", "false")
    monkeypatch.setenv("LLM", "ollama")
    monkeypatch.setenv("OLLAMA_MODEL", "custom-local-model:latest")
    monkeypatch.setenv("DISABLE_IMAGE_GENERATION", "true")

    async def list_models():
        return [
            OllamaModelStatus(
                name="custom-local-model:latest",
                size=1,
                downloaded=1,
                status="pulled",
                done=True,
            )
        ]

    monkeypatch.setattr(model_availability, "list_available_ollama_models", list_models)

    asyncio.run(check_llm_and_image_provider_api_or_model_availability())
