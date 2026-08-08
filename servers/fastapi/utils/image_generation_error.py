from typing import Any

from fastapi import HTTPException
from openai import APIError as OpenAIAPIError

from utils.provider_error_messages import safe_provider_error_detail


class ImageGenerationHTTPException(HTTPException):
    def __init__(
        self, *, status_code: int, detail: str, provider_code: str | None = None
    ):
        super().__init__(status_code=status_code, detail=detail)
        self.provider_code = provider_code


def _openai_error_code(error: OpenAIAPIError) -> str | None:
    body = getattr(error, "body", None)
    if not isinstance(body, dict):
        return None

    nested_error = body.get("error")
    if isinstance(nested_error, dict):
        code = nested_error.get("code")
        return str(code) if code else None

    code = body.get("code")
    return str(code) if code else None


def _openai_error_type(error: OpenAIAPIError) -> str | None:
    body = getattr(error, "body", None)
    if not isinstance(body, dict):
        return None

    nested_error = body.get("error")
    if isinstance(nested_error, dict):
        error_type = nested_error.get("type")
        return str(error_type) if error_type else None

    error_type = body.get("type")
    return str(error_type) if error_type else None


def openai_error_detail(error: OpenAIAPIError, *, operation: str) -> str:
    return safe_provider_error_detail(
        "OpenAI",
        operation,
        status_code=getattr(error, "status_code", None),
        code=_openai_error_code(error),
        error_type=_openai_error_type(error),
        message=getattr(error, "body", None)
        or getattr(error, "message", None)
        or str(error),
    )


def normalize_image_generation_error(error: Exception) -> HTTPException:
    if isinstance(error, HTTPException):
        return error

    if isinstance(error, OpenAIAPIError):
        return ImageGenerationHTTPException(
            status_code=getattr(error, "status_code", None) or 500,
            detail=openai_error_detail(error, operation="image generation"),
            provider_code=_openai_error_code(error),
        )

    return ImageGenerationHTTPException(
        status_code=500,
        detail="Image generation failed. Please try again or use a different prompt.",
    )


def image_generation_warning(error: Exception) -> dict[str, Any]:
    normalized = normalize_image_generation_error(error)
    code = (
        _openai_error_code(error)
        if isinstance(error, OpenAIAPIError)
        else getattr(error, "provider_code", None)
    )
    return {
        "status_code": normalized.status_code,
        "detail": str(normalized.detail),
        "code": code,
    }
