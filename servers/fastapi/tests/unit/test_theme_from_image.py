import io
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.v1.ppt.endpoints.theme_generate import THEME_ROUTER, ReferencePalette
from utils.theme_utils import generate_color_palette

FAKE_SEEDS = ReferencePalette(
    primary="#7C5CFF",
    background="#0A0D18",
    accent_1="#2A3352",
    accent_2="#00FFAA",
    text_1="#FFFFFF",
    text_2="#E6EAF5",
    mood="dark futuristic glass",
)


def _build_client() -> TestClient:
    app = FastAPI()
    app.include_router(THEME_ROUTER)
    return TestClient(app)


def _png_bytes() -> bytes:
    # Minimal 1x1 PNG.
    return bytes.fromhex(
        "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
        "1f15c4890000000a49444154789c6360000002000100ffff03000006000557"
        "0f2b0000000049454e44ae426082"
    )


def test_from_image_returns_theme_matching_seeded_palette():
    client = _build_client()

    with patch(
        "api.v1.ppt.endpoints.theme_generate.generate_structured_with_schema_retries",
        new=AsyncMock(return_value=FAKE_SEEDS.model_dump()),
    ), patch(
        "api.v1.ppt.endpoints.theme_generate.get_client", return_value=object()
    ), patch(
        "api.v1.ppt.endpoints.theme_generate.get_llm_config", return_value={}
    ), patch(
        "api.v1.ppt.endpoints.theme_generate.get_model", return_value="fake-model"
    ):
        response = client.post(
            "/theme/from-image",
            files={"image": ("ref.png", _png_bytes(), "image/png")},
        )

    assert response.status_code == 200
    body = response.json()

    expected_palette = generate_color_palette(
        FAKE_SEEDS.primary,
        FAKE_SEEDS.background,
        FAKE_SEEDS.accent_1,
        FAKE_SEEDS.accent_2,
        FAKE_SEEDS.text_1,
        FAKE_SEEDS.text_2,
    )
    assert body["theme"]["background"] == expected_palette.background
    assert body["seeds"]["mood"] == "dark futuristic glass"


def test_from_image_rejects_unsupported_content_type():
    client = _build_client()

    response = client.post(
        "/theme/from-image",
        files={"image": ("ref.txt", b"not an image", "text/plain")},
    )

    assert response.status_code == 400
