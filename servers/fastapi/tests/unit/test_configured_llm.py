import os
import time
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from llmai.shared import ChatGPTClientConfig, GenerationDefaults
from openai import Omit

from services import codex_credentials, configured_llm
from services.codex_models import CodexModel
from utils.get_env import get_llm_provider_env
from utils.llm_provider import get_model


@pytest.fixture
def configured_codex(monkeypatch):
    config = {
        "LLM": "codex", "CODEX_MODEL": "future-account-model", "CODEX_ACCESS_TOKEN": "test-access",
        "CODEX_REFRESH_TOKEN": "test-refresh", "CODEX_ACCOUNT_ID": "test-account",
        "CODEX_TOKEN_EXPIRES": str(int(time.time() * 1000) + 3600000),
    }
    snapshot = codex_credentials._snapshot(config)
    monkeypatch.setenv("LLM", "codex")
    monkeypatch.setattr(codex_credentials, "refresh_credentials", lambda: snapshot)
    monkeypatch.setattr(codex_credentials, "ensure_current", lambda observed: None)
    model = CodexModel(id="future-account-model", name="Future", context_window=200000, supported_reasoning_levels=("low", "high", "ultra"))
    monkeypatch.setattr(configured_llm, "fetch_catalog", lambda *args: (model,))
    return config, snapshot, model


def test_unknown_model_uses_exact_id_and_captured_credential_config(monkeypatch, configured_codex):
    config, snapshot, model = configured_codex
    def fetch(*args):
        monkeypatch.setenv("LLM", "openrouter")
        monkeypatch.setenv("CODEX_MODEL", "another-request-model")
        return (model,)
    monkeypatch.setattr(configured_llm, "fetch_catalog", fetch)
    resolved = configured_llm.resolve_configured_llm()
    assert resolved.model == "future-account-model"
    assert resolved.client_config.access_token == "test-access"
    assert resolved.client_config.account_id == "test-account"
    assert resolved.metadata == model
    assert resolved.context_window == 200000
    assert resolved.client_config.generation.capability_overrides == {
        "chatgpt:future-account-model": {"reasoning": True, "reasoning_levels": ["low", "high"]},
    }
    assert os.environ["CODEX_MODEL"] == "another-request-model"


def test_non_codex_existing_extension_seam_uses_one_environment(monkeypatch):
    monkeypatch.setenv("LLM", "openai")
    monkeypatch.setenv("OPENAI_MODEL", "configured-openai-model")
    def build_config():
        monkeypatch.setenv("LLM", "codex")
        assert get_llm_provider_env() == "openai"
        return SimpleNamespace(generation=GenerationDefaults())
    resolved = configured_llm.resolve_configured_llm(
        config_factory=build_config, model_factory=get_model,
        client_factory=lambda config: SimpleNamespace(),
    )
    assert resolved.model == "configured-openai-model"
    assert resolved.metadata is None


def test_smart_reasoning_uses_captured_non_codex_disable_after_another_request(monkeypatch):
    from utils.llm_calls import generate_smart_presentation as smart
    monkeypatch.setenv("LLM", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "fixture-api-key")
    monkeypatch.setenv("OPENAI_MODEL", "fixture-model")
    monkeypatch.setenv("DISABLE_THINKING", "true")
    monkeypatch.delenv("LLM_REASONING_MODE", raising=False)
    monkeypatch.delenv("LLM_REASONING_EFFORT", raising=False)
    monkeypatch.delenv("LLM_REASONING_BUDGET_TOKENS", raising=False)
    resolved = configured_llm.resolve_configured_llm(client_factory=lambda config: SimpleNamespace())
    assert resolved.client_config.generation.reasoning.enabled is False
    monkeypatch.setenv("DISABLE_THINKING", "false")
    monkeypatch.setattr(smart.llmai, "supports_thinking", lambda *args, **kwargs: True)
    reasoning, supports_thinking = smart.get_smart_reasoning_config(resolved.model, resolved.client)
    assert reasoning is None
    assert supports_thinking is False


def test_catalog_is_fetched_for_each_operation(configured_codex, monkeypatch):
    _, _, model = configured_codex
    calls = []
    monkeypatch.setattr(configured_llm, "fetch_catalog", lambda *args: calls.append(1) or (model,))
    configured_llm.discover_models()
    configured_llm.resolve_configured_llm()
    assert len(calls) == 2


def test_catalog_error_never_replaces_a_saved_model(configured_codex, monkeypatch):
    _, _, model = configured_codex
    monkeypatch.setattr(configured_llm, "fetch_catalog", lambda *args: ())
    with pytest.raises(HTTPException) as error:
        configured_llm.resolve_configured_llm()
    assert error.value.status_code == 400


def test_catalog_adapter_preserves_model_and_only_proven_wire_capabilities():
    metadata = CodexModel(id="future", name="Future", parallel_tool_calls=False, supports_reasoning_summary_parameter=False)
    client = configured_llm.CatalogChatGPTClient(config=ChatGPTClientConfig(access_token="test-access"), metadata=metadata)
    request = client._responses_request_kwargs(
        model="future", messages=[], tools=None, tool_choice=None,
        response_format=None, reasoning_effort=None, extra_body={"parallel_tool_calls": True}, stream=True,
    )
    assert request["model"] == "future"
    assert request["extra_body"]["parallel_tool_calls"] is False
    assert isinstance(request["reasoning"], Omit)
    assert isinstance(request["max_output_tokens"], Omit)


def test_template_default_client_also_uses_catalog_adapter(configured_codex, monkeypatch):
    from templates.v2 import generation
    resolved = generation.resolve_configured_llm()
    assert isinstance(resolved.client, configured_llm.CatalogChatGPTClient)
    assert resolved.model == "future-account-model"


@pytest.mark.parametrize("change", [
    {"LLM_REASONING_EFFORT": "ultra"}, {"CODEX_MODEL": "removed-model"},
    {"LLM_MAX_OUTPUT_TOKENS": "-1"}, {"LLM_CONTEXT_WINDOW": "-1"},
    {"LLM_GENERATION_PROFILE": "model_max"}, {"LLM_REASONING_BUDGET_TOKENS": "1000"},
])
def test_invalid_explicit_settings_fail_before_sdk_network(configured_codex, change):
    config, snapshot, _ = configured_codex
    with pytest.raises(HTTPException) as error:
        configured_llm.validate_codex_configuration({**config, **change}, credentials=snapshot)
    assert error.value.status_code == 400
