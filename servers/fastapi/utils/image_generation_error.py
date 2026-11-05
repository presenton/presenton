from typing import Any

from fastapi import HTTPException
from openai import APIError as OpenAIAPIError

from utils.provider_error_messages import safe_provider_error_detail
from utils.provider_errors import normalize_provider_error


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

    normalized = normalize_provider_error(
        error, provider="OpenAI" if isinstance(error, OpenAIAPIError) else "image provider",
        operation="image generation", source="image",
    )
    # Preserve legacy image-warning codes without copying arbitrary provider data.
    code = _openai_error_code(error) if isinstance(error, OpenAIAPIError) else None
    normalized.provider_code = code if code in {"insufficient_quota", "moderation_blocked", "invalid_api_key"} else None
    return normalized


def image_generation_warning(error: Exception) -> dict[str, Any]:
    normalized = normalize_image_generation_error(error)
    code = getattr(normalized, "provider_code", None)
    if code not in {"insufficient_quota", "moderation_blocked", "invalid_api_key"}:
        code = None
    return {
        "status_code": normalized.status_code,
        "detail": str(normalized.detail),
        "code": code,
        "error_code": getattr(normalized, "error_code", None),
        "retryable": getattr(normalized, "retryable", False),
    }
