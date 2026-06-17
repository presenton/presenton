from typing import Any

from fastapi import HTTPException
from openai import APIError as OpenAIAPIError


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


def openai_error_detail(error: OpenAIAPIError, *, operation: str) -> str:
    code = _openai_error_code(error)
    if code == "insufficient_quota":
        return (
            f"OpenAI {operation} failed because API quota is unavailable. "
            "Check OpenAI API billing and the limits for the project that owns this API key."
        )

    message = getattr(error, "message", None) or str(error)
    return f"OpenAI {operation} failed: {message}"


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
        detail=f"Image generation failed: {error}",
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
