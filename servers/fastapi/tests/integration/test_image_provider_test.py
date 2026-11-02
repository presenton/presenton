import base64
import os
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from PIL import Image

from api.v1.ppt.endpoints.images import IMAGES_ROUTER
from services.image_generation_service import ImageGenerationService


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(IMAGES_ROUTER)
    return TestClient(app)


@pytest.mark.parametrize(("provider", "method", "fields"), [
    ("gpt-image-2", "generate_image_openai_gpt_image_2", {"OPENAI_API_KEY": "draft-key"}),
    ("gpt-image-2.5-flare", "generate_image_openai_gpt_image_2_5_flare", {"OPENAI_API_KEY": "draft-key"}),
    ("gpt-image-2.5-sunburst", "generate_image_openai_gpt_image_2_5_sunburst", {"OPENAI_API_KEY": "draft-key"}),
    ("gemini_flash", "generate_image_gemini_flash", {"GOOGLE_API_KEY": "draft-key"}),
    ("nanobanana_pro", "generate_image_nanobanana_pro", {"GOOGLE_API_KEY": "draft-key"}),
    ("pexels", "get_image_from_pexels", {"PEXELS_API_KEY": "draft-key"}),
    ("pixabay", "get_image_from_pixabay", {"PIXABAY_API_KEY": "draft-key"}),
    ("comfyui", "generate_image_comfyui", {"COMFYUI_URL": "http://localhost:8188", "COMFYUI_WORKFLOW": '{"1": {}}'}),
    ("open_webui", "generate_image_open_webui", {"OPEN_WEBUI_IMAGE_URL": "http://localhost:8080"}),
    ("openai_compatible", "generate_image_openai_compatible", {
        "OPENAI_COMPAT_IMAGE_BASE_URL": "http://localhost:4000/v1",
        "OPENAI_COMPAT_IMAGE_API_KEY": "draft-key", "OPENAI_COMPAT_IMAGE_MODEL": "draft-model",
    }),
])
def test_uses_unsaved_provider_without_changing_runtime_or_saving_assets(
    client, monkeypatch, provider, method, fields,
):
    monkeypatch.setenv("IMAGE_PROVIDER", "pixabay")
    monkeypatch.setenv("DISABLE_IMAGE_GENERATION", "true")
    environment = dict(os.environ)
    directories = []

    async def generate(service, prompt, *_args, **_kwargs):
        assert service.config["IMAGE_PROVIDER"] == provider
        assert all(service.config[key] == value for key, value in fields.items())
        assert dict(os.environ) == environment
        directories.append(service.output_directory)
        if provider in {"pexels", "pixabay"}:
            return "https://example.com/stock.jpg"
        path = Path(service.output_directory) / "test.png"
        Image.new("RGB", (2, 2)).save(path)
        return str(path)

    monkeypatch.setattr(ImageGenerationService, method, generate)
    response = client.post("/images/test", json={"IMAGE_PROVIDER": provider, **fields})

    assert response.status_code == 200, response.text
    preview = response.json()["image_url"]
    if provider in {"pexels", "pixabay"}:
        assert preview == "https://example.com/stock.jpg"
    else:
        assert base64.b64decode(preview.split(",", 1)[1]).startswith(b"\x89PNG")
    assert all(not Path(directory).exists() for directory in directories)
    assert dict(os.environ) == environment


@pytest.mark.parametrize("config", [
    {}, {"IMAGE_PROVIDER": "unsupported"}, {"IMAGE_PROVIDER": "gpt-image-2"},
    {"IMAGE_PROVIDER": "gpt-image-2.5-flare"},
    {"IMAGE_PROVIDER": "gpt-image-2.5-sunburst"},
    {"IMAGE_PROVIDER": "open_webui", "OPEN_WEBUI_IMAGE_URL": " "},
    {"IMAGE_PROVIDER": "comfyui", "COMFYUI_URL": "http://localhost:8188", "COMFYUI_WORKFLOW": "[]"},
    {"IMAGE_PROVIDER": "comfyui", "COMFYUI_URL": "http://localhost:8188", "COMFYUI_WORKFLOW": "{"},
])
def test_incomplete_configuration_does_not_call_provider(client, config):
    with patch.object(ImageGenerationService, "generate_image", new_callable=AsyncMock) as generate:
        response = client.post("/images/test", json=config)
    assert response.status_code in {400, 422}
    generate.assert_not_awaited()


@pytest.mark.parametrize("output", ["/static/images/placeholder.jpg", "https://example.com/static/images/placeholder.jpg", ""])
def test_placeholder_is_not_a_success(client, output):
    with patch.object(ImageGenerationService, "generate_image", new_callable=AsyncMock, return_value=output):
        response = client.post("/images/test", json={"IMAGE_PROVIDER": "gpt-image-2", "OPENAI_API_KEY": "key"})
    assert response.status_code == 502


def test_provider_error_is_reported(client):
    with patch.object(ImageGenerationService, "generate_image", new_callable=AsyncMock, side_effect=HTTPException(429, "Provider quota exhausted")):
        response = client.post("/images/test", json={"IMAGE_PROVIDER": "gpt-image-2", "OPENAI_API_KEY": "key"})
    assert response.status_code == 429
    assert response.json()["detail"] == "Provider quota exhausted"


def test_timeout_is_reported_and_temporary_files_are_removed(client, monkeypatch):
    directories = []
    async def time_out(coroutine, timeout):
        assert timeout == 180
        coroutine.close()
        raise TimeoutError()

    original_init = ImageGenerationService.__init__
    def init(service, directory, **kwargs):
        directories.append(directory)
        original_init(service, directory, **kwargs)

    monkeypatch.setattr(ImageGenerationService, "__init__", init)
    monkeypatch.setattr("api.v1.ppt.endpoints.images.asyncio.wait_for", time_out)
    response = client.post("/images/test", json={"IMAGE_PROVIDER": "gpt-image-2", "OPENAI_API_KEY": "key"})
    assert response.status_code == 504
    assert all(not Path(directory).exists() for directory in directories)


def test_openai_client_receives_draft_key_and_quality(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "saved-key")
    monkeypatch.setenv("GPT_IMAGE_2_QUALITY", "high")
    async def generate(**kwargs):
        assert kwargs["quality"] == "low"
        from io import BytesIO
        buffer = BytesIO()
        Image.new("RGB", (1, 1)).save(buffer, format="PNG")
        return SimpleNamespace(data=[SimpleNamespace(b64_json=base64.b64encode(buffer.getvalue()).decode())])

    sdk = SimpleNamespace(images=SimpleNamespace(generate=generate))
    with patch("services.image_generation_service.AsyncOpenAI", return_value=sdk) as constructor:
        response = client.post("/images/test", json={"IMAGE_PROVIDER": "gpt-image-2", "OPENAI_API_KEY": "draft-key", "GPT_IMAGE_2_QUALITY": "low"})
    assert response.status_code == 200, response.text
    constructor.assert_called_once_with(api_key="draft-key")


def test_redacted_key_uses_configured_secret(client, monkeypatch):
    monkeypatch.setenv("PEXELS_API_KEY", "saved-secret")
    observed = []
    async def search(service, prompt, **kwargs):
        assert service.config["PEXELS_API_KEY"] == "saved-secret"
        observed.append(prompt)
        return "https://example.com/stock.jpg"
    monkeypatch.setattr(ImageGenerationService, "get_image_from_pexels", search)
    response = client.post("/images/test", json={"IMAGE_PROVIDER": "pexels", "PEXELS_API_KEY": "__configured__"})
    assert response.status_code == 200
    assert observed[0].startswith("__presenton_auth_check_")
    assert len(observed) == 2


@pytest.mark.parametrize("provider", ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"])
@pytest.mark.parametrize("quality", ["low", "medium", "high", "xhigh", "max", "auto"])
def test_gpt_image_2_5_draft_configuration_reaches_openai(client, monkeypatch, provider, quality):
    monkeypatch.setenv("OPENAI_API_KEY", "saved-key")
    monkeypatch.setenv("GPT_IMAGE_2_5_QUALITY", "high")

    async def generate(**kwargs):
        assert kwargs["model"] == provider
        assert kwargs["quality"] == quality
        from io import BytesIO
        buffer = BytesIO()
        Image.new("RGB", (1, 1)).save(buffer, format="PNG")
        return SimpleNamespace(data=[SimpleNamespace(b64_json=base64.b64encode(buffer.getvalue()).decode())])

    sdk = SimpleNamespace(images=SimpleNamespace(generate=generate))
    with patch("services.image_generation_service.AsyncOpenAI", return_value=sdk) as constructor:
        response = client.post("/images/test", json={
            "IMAGE_PROVIDER": provider, "OPENAI_API_KEY": "draft-key",
            "GPT_IMAGE_2_5_QUALITY": quality,
        })
    assert response.status_code == 200, response.text
    constructor.assert_called_once_with(api_key="draft-key")


@pytest.mark.parametrize("legacy_provider", ["gpt-image-1.5", "gpt-image-1.5-2025-12-16"])
def test_image_provider_test_migrates_old_drafts(client, monkeypatch, legacy_provider):
    async def generate(service, *_args, **_kwargs):
        assert service.config["IMAGE_PROVIDER"] == "gpt-image-2.5-flare"
        assert service.config["GPT_IMAGE_2_5_QUALITY"] == "high"
        path = Path(service.output_directory) / "test.png"
        Image.new("RGB", (1, 1)).save(path)
        return str(path)

    monkeypatch.setattr(ImageGenerationService, "generate_image_openai_gpt_image_2_5_flare", generate)
    response = client.post("/images/test", json={
        "IMAGE_PROVIDER": legacy_provider, "OPENAI_API_KEY": "draft-key",
        "GPT_IMAGE_1_5_QUALITY": "high",
    })
    assert response.status_code == 200, response.text
