import base64
import os
from unittest.mock import patch

import pytest

from services.image_generation_service import (
    ImageGenerationService,
    resolve_open_webui_api_base,
)

PNG_BYTES = b"\x89PNG\r\n\x1a\n fake image bytes"


@pytest.fixture
def anyio_backend():
    return "asyncio"


class _FakeResponse:
    def __init__(self, status: int, body):
        self.status = status
        self._body = body

    async def json(self):
        return self._body

    async def text(self):
        return str(self._body)


class _FakeSession:
    """Stands in for aiohttp.ClientSession and records every POST."""

    calls: list[tuple[str, dict]] = []
    response: _FakeResponse = _FakeResponse(200, [])

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    async def post(self, url, **kwargs):
        type(self).calls.append((url, kwargs))
        return type(self).response


@pytest.fixture
def fake_session():
    class FakeSession(_FakeSession):
        calls = []
        response = _FakeResponse(
            200, [{"b64_json": base64.b64encode(PNG_BYTES).decode()}]
        )

    with patch("services.image_generation_service.aiohttp.ClientSession", FakeSession):
        yield FakeSession


def _open_webui_env(url: str, api_key: str = "sk-open-webui"):
    return (
        patch(
            "services.image_generation_service.get_open_webui_image_url_env",
            return_value=url,
        ),
        patch(
            "services.image_generation_service.get_open_webui_image_api_key_env",
            return_value=api_key,
        ),
    )


@pytest.mark.parametrize(
    ("configured", "expected"),
    [
        ("http://127.0.0.1:8080", "http://127.0.0.1:8080/api/v1"),
        ("http://127.0.0.1:8080/", "http://127.0.0.1:8080/api/v1"),
        ("  http://127.0.0.1:8080  ", "http://127.0.0.1:8080/api/v1"),
        ("http://localhost:3000/api/v1", "http://localhost:3000/api/v1"),
        ("http://localhost:3000/api/v1/", "http://localhost:3000/api/v1"),
        ("https://gateway.example.com/v1", "https://gateway.example.com/v1"),
    ],
)
def test_resolve_open_webui_api_base(configured, expected):
    assert resolve_open_webui_api_base(configured) == expected


@pytest.mark.anyio
async def test_generate_image_open_webui_bare_origin_posts_to_api_v1(
    tmp_path, fake_session
):
    service = ImageGenerationService(str(tmp_path))
    url_env, key_env = _open_webui_env("http://127.0.0.1:8080")

    with url_env, key_env:
        image_path = await service.generate_image_open_webui(
            "a lighthouse at dusk", str(tmp_path)
        )

    assert len(fake_session.calls) == 1
    posted_url, kwargs = fake_session.calls[0]
    assert posted_url == "http://127.0.0.1:8080/api/v1/images/generations"
    assert kwargs["headers"]["Authorization"] == "Bearer sk-open-webui"
    assert kwargs["json"]["prompt"] == "a lighthouse at dusk"
    assert os.path.dirname(image_path) == str(tmp_path)
    with open(image_path, "rb") as f:
        assert f.read() == PNG_BYTES


@pytest.mark.anyio
async def test_generate_image_open_webui_keeps_explicit_api_root(
    tmp_path, fake_session
):
    service = ImageGenerationService(str(tmp_path))
    url_env, key_env = _open_webui_env("http://localhost:3000/api/v1/")

    with url_env, key_env:
        await service.generate_image_open_webui("a cat", str(tmp_path))

    posted_url, _ = fake_session.calls[0]
    assert posted_url == "http://localhost:3000/api/v1/images/generations"


@pytest.mark.anyio
async def test_generate_image_open_webui_405_error_points_at_api_root(
    tmp_path, fake_session
):
    fake_session.response = _FakeResponse(405, "Method Not Allowed")
    service = ImageGenerationService(str(tmp_path))
    url_env, key_env = _open_webui_env("http://127.0.0.1:8080/openwebui")

    with url_env, key_env, pytest.raises(Exception) as exc_info:
        await service.generate_image_open_webui("a cat", str(tmp_path))

    message = str(exc_info.value)
    assert "returned 405" in message
    assert "http://127.0.0.1:8080/api/v1" in message
