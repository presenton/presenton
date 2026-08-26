from llmai import CapabilityStatus, CapabilityValue, ModelCapabilities

from api.v1.ppt.endpoints import generation


def _capabilities(max_output_tokens: int | None) -> ModelCapabilities:
    return ModelCapabilities(
        model="test-model",
        provider="openai",
        max_output_tokens=CapabilityValue(
            status=(
                CapabilityStatus.SUPPORTED
                if max_output_tokens is not None
                else CapabilityStatus.UNKNOWN
            ),
            value=max_output_tokens,
        ),
    )


def test_generation_defaults_use_model_metadata(monkeypatch):
    monkeypatch.setattr(
        generation,
        "get_model_capabilities",
        lambda _model, provider: _capabilities(16_384),
    )

    result = generation.resolve_generation_token_defaults("openai", "gpt-test")

    assert result.default_max_output_tokens == 16_384
    assert result.model_max_output_tokens == 16_384


def test_generation_defaults_fall_back_for_unknown_models(monkeypatch):
    monkeypatch.setattr(
        generation,
        "get_model_capabilities",
        lambda _model, provider: _capabilities(None),
    )

    result = generation.resolve_generation_token_defaults("custom", "")

    assert result.default_max_output_tokens == 8_192
    assert result.model_max_output_tokens == 32_768
