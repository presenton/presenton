from llmai import AzureOpenAIClientConfig, DeepSeekClientConfig
from llmai.shared import OpenAIApiType, OpenAIClientConfig

from utils.llm_config import get_extra_body, get_llm_config


def test_openai_uses_responses_api_only_for_native_web_search(monkeypatch):
    monkeypatch.setenv("LLM", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    regular_config = get_llm_config()
    search_config = get_llm_config(use_openai_responses_api=True)

    assert regular_config.api_type == OpenAIApiType.COMPLETIONS
    assert search_config.api_type == OpenAIApiType.RESPONSES


def test_azure_uses_responses_api(monkeypatch):
    monkeypatch.setenv("LLM", "azure")
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("AZURE_OPENAI_API_VERSION", "2024-10-21")
    monkeypatch.setenv(
        "AZURE_OPENAI_ENDPOINT",
        "https://test-resource.openai.azure.com",
    )

    config = get_llm_config()

    assert isinstance(config, AzureOpenAIClientConfig)
    assert config.api_type == OpenAIApiType.RESPONSES


def test_deepseek_provider_uses_deepseek_client_config(monkeypatch):
    monkeypatch.setenv("LLM", "deepseek")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "deepseek-key")
    monkeypatch.setenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")

    config = get_llm_config()

    assert isinstance(config, DeepSeekClientConfig)
    assert config.base_url == "https://api.deepseek.com/v1"


def test_custom_provider_uses_openai_client_config(monkeypatch):
    monkeypatch.setenv("LLM", "custom")
    monkeypatch.setenv("CUSTOM_LLM_URL", "http://localhost:11434/v1")
    monkeypatch.setenv("CUSTOM_LLM_API_KEY", "custom-key")

    config = get_llm_config()

    assert isinstance(config, OpenAIClientConfig)


def test_conifer_provider_uses_openai_client_config(monkeypatch):
    monkeypatch.setenv("LLM", "conifer")
    monkeypatch.setenv("CONIFER_API_KEY", "sk-conifer-test")
    monkeypatch.delenv("CONIFER_BASE_URL", raising=False)

    config = get_llm_config()

    assert isinstance(config, OpenAIClientConfig)
    assert config.base_url == "https://api.conifer.build/v1"
    assert config.api_key == "sk-conifer-test"


def test_conifer_base_url_override_is_normalized(monkeypatch):
    monkeypatch.setenv("LLM", "conifer")
    monkeypatch.setenv("CONIFER_API_KEY", "sk-conifer-test")
    monkeypatch.setenv("CONIFER_BASE_URL", "http://localhost:8790")

    config = get_llm_config()

    assert config.base_url == "http://localhost:8790/v1"


def test_deepseek_disable_thinking_uses_deepseek_payload(monkeypatch):
    monkeypatch.setenv("LLM", "deepseek")
    monkeypatch.setenv("DISABLE_THINKING", "true")

    extra_body = get_extra_body()

    assert extra_body == {"thinking": {"type": "disabled"}}


def test_deepseek_tool_choice_disables_thinking(monkeypatch):
    monkeypatch.setenv("LLM", "deepseek")
    monkeypatch.setenv("DISABLE_THINKING", "false")

    extra_body = get_extra_body(uses_tool_choice=True)

    assert extra_body == {"thinking": {"type": "disabled"}}


def test_deepseek_regular_request_keeps_thinking_default(monkeypatch):
    monkeypatch.setenv("LLM", "deepseek")
    monkeypatch.setenv("DISABLE_THINKING", "false")

    extra_body = get_extra_body()

    assert extra_body is None


def test_custom_disable_thinking_uses_legacy_payload(monkeypatch):
    monkeypatch.setenv("LLM", "custom")
    monkeypatch.setenv("DISABLE_THINKING", "true")

    extra_body = get_extra_body()

    assert extra_body == {"enable_thinking": False}


def test_explicit_reasoning_overrides_legacy_deepseek_payload(monkeypatch):
    monkeypatch.setenv("LLM", "deepseek")
    monkeypatch.setenv("DISABLE_THINKING", "true")
    monkeypatch.setenv("LLM_REASONING_MODE", "enabled")

    assert get_extra_body() is None


def test_explicit_reasoning_overrides_legacy_custom_payload(monkeypatch):
    monkeypatch.setenv("LLM", "custom")
    monkeypatch.setenv("DISABLE_THINKING", "true")
    monkeypatch.setenv("LLM_REASONING_MODE", "enabled")

    assert get_extra_body() is None


def test_advanced_generation_defaults_apply_to_every_client(monkeypatch):
    monkeypatch.setenv("LLM", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("LLM_GENERATION_PROFILE", "deep")
    monkeypatch.setenv("LLM_MAX_OUTPUT_TOKENS", "65536")
    monkeypatch.setenv("LLM_REASONING_MODE", "enabled")
    monkeypatch.setenv("LLM_REASONING_EFFORT", "high")
    monkeypatch.setenv("LLM_REASONING_BUDGET_TOKENS", "4096")

    config = get_llm_config()

    assert config.generation.profile.value == "deep"
    assert config.generation.max_output_tokens == 65536
    assert config.generation.reasoning.enabled is True
    assert config.generation.reasoning.effort.value == "high"
    assert config.generation.reasoning.budget_tokens == 4096


def test_new_reasoning_mode_wins_over_legacy_disable(monkeypatch):
    monkeypatch.setenv("LLM", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("DISABLE_THINKING", "true")
    monkeypatch.setenv("LLM_REASONING_MODE", "enabled")

    config = get_llm_config()

    assert config.generation.reasoning.enabled is True


def test_openrouter_routing_merges_optional_controls(monkeypatch):
    monkeypatch.setenv("LLM", "openrouter")
    monkeypatch.setenv("OPENROUTER_PROVIDER_ORDER", "groq, together")
    monkeypatch.setenv("OPENROUTER_ALLOW_FALLBACKS", "false")
    monkeypatch.setenv("OPENROUTER_REQUIRE_PARAMETERS", "true")
    monkeypatch.setenv("OPENROUTER_DATA_COLLECTION", "deny")
    monkeypatch.setenv("OPENROUTER_ZDR", "true")

    extra_body = get_extra_body()

    assert extra_body == {
        "provider": {
            "order": ["groq", "together"],
            "allow_fallbacks": False,
            "require_parameters": True,
            "data_collection": "deny",
            "zdr": True,
        }
    }
