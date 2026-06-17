from constants.supported_ollama_models import (
    TESTED_OLLAMA_MODELS,
    format_ollama_model_size,
    get_supported_ollama_models,
)
from models.ollama_model_status import OllamaModelStatus


def test_supported_ollama_models_append_pulled_experimental_models():
    pulled_models = [
        OllamaModelStatus(
            name="qwen3:8b",
            size=5 * 1024**3,
            downloaded=5 * 1024**3,
            status="pulled",
            done=True,
        ),
        OllamaModelStatus(
            name="custom-local-model:latest",
            size=3 * 1024**3,
            downloaded=3 * 1024**3,
            status="pulled",
            done=True,
        ),
    ]

    models = get_supported_ollama_models(pulled_models)

    assert len(models) == len(TESTED_OLLAMA_MODELS) + 1
    assert models[0].tested is True
    assert models[-1].value == "custom-local-model:latest"
    assert models[-1].label == "custom-local-model:latest"
    assert models[-1].size == "3.0GB"
    assert models[-1].tested is False
    assert [model.value for model in models].count("qwen3:8b") == 1


def test_format_ollama_model_size_handles_missing_size():
    assert format_ollama_model_size(None) == "Unknown size"
