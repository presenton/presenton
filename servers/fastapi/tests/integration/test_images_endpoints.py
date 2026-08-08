import io
from unittest.mock import AsyncMock, Mock, patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from PIL import Image

from api.v1.ppt.endpoints.images import IMAGES_ROUTER
from models.sql.image_asset import ImageAsset
from services.database import get_async_session


def _build_client(fake_async_session):
    app = FastAPI()
    app.include_router(IMAGES_ROUTER)
    app.dependency_overrides[get_async_session] = lambda: fake_async_session
    return TestClient(app)


def _png_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (1, 1), color=(255, 0, 0)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_search_images_with_provider_alias_returns_list(fake_async_session):
    client = _build_client(fake_async_session)

    with patch(
        "api.v1.ppt.endpoints.images.get_images_directory", return_value="/tmp"
    ), patch("api.v1.ppt.endpoints.images.ImageGenerationService") as mock_service_cls:
        service = Mock()
        service.get_image_from_pexels = AsyncMock(
            return_value=["https://img.example.com/a.jpg", "https://img.example.com/b.jpg"]
        )
        mock_service_cls.return_value = service

        response = client.get("/images/search?query=ai&provider=pexel&limit=2")

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 2
    assert all(item.startswith("https://") for item in body)


def test_search_images_strict_mode_requires_api_key(fake_async_session):
    client = _build_client(fake_async_session)

    with patch("api.v1.ppt.endpoints.images.get_images_directory", return_value="/tmp"):
        response = client.get(
            "/images/search?query=ai&provider=pexels&strict_api_key=true"
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Pexels API key is required"


def test_search_images_uses_configured_key_for_redacted_runtime_secret(
    fake_async_session,
):
    client = _build_client(fake_async_session)

    with patch(
        "api.v1.ppt.endpoints.images.get_images_directory", return_value="/tmp"
    ), patch(
        "api.v1.ppt.endpoints.images.get_pexels_api_key_env",
        return_value="server-pexels-key",
    ), patch(
        "api.v1.ppt.endpoints.images.ImageGenerationService"
    ) as mock_service_cls:
        service = Mock()
        service.get_image_from_pexels = AsyncMock(
            side_effect=[
                "https://img.example.com/validation.jpg",
                ["https://img.example.com/a.jpg"],
            ]
        )
        mock_service_cls.return_value = service

        response = client.get(
            "/images/search?query=business&provider=pexels&strict_api_key=true",
            headers={"X-Provider-Api-Key": "__configured__"},
        )

    assert response.status_code == 200
    assert response.json() == ["https://img.example.com/a.jpg"]
    assert service.get_image_from_pexels.await_count == 2
    assert all(
        call.kwargs["api_key"] == "server-pexels-key"
        for call in service.get_image_from_pexels.await_args_list
    )


def test_generate_image_returns_image_path_and_persists_image_asset(fake_async_session):
    client = _build_client(fake_async_session)
    generated_asset = ImageAsset(path="/tmp/generated/a.png", is_uploaded=False)

    with patch(
        "api.v1.ppt.endpoints.images.get_images_directory", return_value="/tmp"
    ), patch("api.v1.ppt.endpoints.images.ImageGenerationService") as mock_service_cls:
        service = Mock()
        service.generate_image = AsyncMock(return_value=generated_asset)
        mock_service_cls.return_value = service

        response = client.get("/images/generate?prompt=business-dashboard")

    assert response.status_code == 200
    assert response.json() == "/tmp/generated/a.png"
    assert fake_async_session.added[-1] == generated_asset
    assert fake_async_session.commit_count == 1


def test_generate_image_returns_placeholder_without_db_write(fake_async_session):
    client = _build_client(fake_async_session)

    with patch(
        "api.v1.ppt.endpoints.images.get_images_directory", return_value="/tmp"
    ), patch("api.v1.ppt.endpoints.images.ImageGenerationService") as mock_service_cls:
        service = Mock()
        service.generate_image = AsyncMock(return_value="/static/images/placeholder.jpg")
        mock_service_cls.return_value = service

        response = client.get("/images/generate?prompt=business-dashboard")

    assert response.status_code == 200
    assert response.json() == "/static/images/placeholder.jpg"
    assert fake_async_session.added == []


def test_generate_image_returns_provider_error_status(fake_async_session):
    client = _build_client(fake_async_session)

    with patch(
        "api.v1.ppt.endpoints.images.get_images_directory", return_value="/tmp"
    ), patch("api.v1.ppt.endpoints.images.ImageGenerationService") as mock_service_cls:
        service = Mock()
        service.generate_image = AsyncMock(
            side_effect=HTTPException(
                status_code=429,
                detail="OpenAI image generation failed because API quota is unavailable.",
            )
        )
        mock_service_cls.return_value = service

        response = client.get("/images/generate?prompt=business-dashboard")

    assert response.status_code == 429
    assert "API quota is unavailable" in response.json()["detail"]
    assert fake_async_session.added == []


def test_upload_image_accepts_valid_image_and_persists_asset(
    tmp_path, fake_async_session
):
    client = _build_client(fake_async_session)

    with patch(
        "api.v1.ppt.endpoints.images.get_images_directory", return_value=str(tmp_path)
    ):
        response = client.post(
            "/images/upload",
            files={"file": ("slide.png", _png_bytes(), "image/png")},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["is_uploaded"] is True
    assert body["path"].endswith(".png")
    assert body["file_url"]
    assert fake_async_session.commit_count == 1
    assert len(fake_async_session.added) == 1
    assert fake_async_session.added[0].path == body["path"]
    assert (tmp_path / body["path"].split("/")[-1]).is_file()


def test_upload_image_rejects_non_image_bytes(tmp_path, fake_async_session):
    client = _build_client(fake_async_session)

    with patch(
        "api.v1.ppt.endpoints.images.get_images_directory", return_value=str(tmp_path)
    ):
        response = client.post(
            "/images/upload",
            files={"file": ("slide.png", b"not an image", "image/png")},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Uploaded file is not a valid image"
    assert fake_async_session.added == []
    assert fake_async_session.commit_count == 0
    assert list(tmp_path.iterdir()) == []


def test_upload_image_rejects_unsupported_extension(tmp_path, fake_async_session):
    client = _build_client(fake_async_session)

    with patch(
        "api.v1.ppt.endpoints.images.get_images_directory", return_value=str(tmp_path)
    ):
        response = client.post(
            "/images/upload",
            files={"file": ("slide.txt", _png_bytes(), "image/png")},
        )

    assert response.status_code == 400
    assert "Invalid image file type" in response.json()["detail"]
    assert fake_async_session.added == []
    assert fake_async_session.commit_count == 0
    assert list(tmp_path.iterdir()) == []
