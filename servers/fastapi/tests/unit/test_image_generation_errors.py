import asyncio
import uuid
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import HTTPException
from openai import RateLimitError

from models.image_prompt import ImagePrompt
from models.sql.slide import SlideModel
from services.image_generation_service import ImageGenerationService
from utils.image_generation_error import normalize_image_generation_error
from utils.llm_client_error_handler import handle_llm_client_exceptions
from utils.process_slides import process_slide_and_fetch_assets


def _quota_error() -> RateLimitError:
    request = httpx.Request("POST", "https://api.openai.com/v1/images/generations")
    response = httpx.Response(429, request=request)
    return RateLimitError(
        "You exceeded your current quota.",
        response=response,
        body={
            "error": {
                "message": "You exceeded your current quota.",
                "code": "insufficient_quota",
            }
        },
    )


def test_normalize_image_generation_error_preserves_openai_quota_status():
    normalized = normalize_image_generation_error(_quota_error())

    assert normalized.status_code == 429
    assert "API quota is unavailable" in normalized.detail
    assert "billing" in normalized.detail


def test_llm_error_handler_preserves_openai_quota_status():
    normalized = handle_llm_client_exceptions(_quota_error())

    assert normalized.status_code == 429
    assert "API quota is unavailable" in normalized.detail


def test_image_generation_service_raises_provider_error_instead_of_placeholder():
    service = object.__new__(ImageGenerationService)
    service.output_directory = "/tmp"
    service.is_image_generation_disabled = False
    service.is_stock_provider_selected = lambda: False
    service.image_gen_func = AsyncMock(side_effect=_quota_error())

    with pytest.raises(HTTPException) as exc:
        asyncio.run(service.generate_image(ImagePrompt(prompt="business dashboard")))

    assert exc.value.status_code == 429
    assert "billing" in exc.value.detail


def test_image_generation_service_preserves_existing_http_exception():
    service = object.__new__(ImageGenerationService)
    service.output_directory = "/tmp"
    service.is_image_generation_disabled = False
    service.is_stock_provider_selected = lambda: False
    provider_error = HTTPException(status_code=401, detail="Invalid provider key")
    service.image_gen_func = AsyncMock(side_effect=provider_error)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(service.generate_image(ImagePrompt(prompt="business dashboard")))

    assert exc.value is provider_error


def test_slide_asset_processing_can_fallback_with_visible_warning():
    slide = SlideModel(
        presentation=uuid.uuid4(),
        layout_group="general",
        layout="layout-1",
        index=0,
        content={
            "image": {
                "__image_prompt__": "business dashboard",
                "__image_url__": "/static/images/placeholder.jpg",
            }
        },
        properties=None,
    )
    image_generation_service = AsyncMock()
    image_generation_service.generate_image.side_effect = normalize_image_generation_error(
        _quota_error()
    )
    warnings: list[dict] = []

    assets = asyncio.run(
        process_slide_and_fetch_assets(
            image_generation_service=image_generation_service,
            slide=slide,
            allow_image_fallback=True,
            image_warnings=warnings,
        )
    )

    assert assets == []
    assert slide.content["image"]["__image_url__"].endswith(
        "/static/images/placeholder.jpg"
    )
    assert warnings == [
        {
            "status_code": 429,
            "detail": (
                "OpenAI image generation failed because API quota is unavailable. "
                "Check OpenAI API billing and the limits for the project that owns this API key."
            ),
            "code": "insufficient_quota",
        }
    ]
