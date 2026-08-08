import json
import re
from typing import Any


INVALID_API_KEY_MESSAGE = "Invalid API key. Please verify your API key and try again."
IMAGE_MODERATION_MESSAGE = (
    "An image request was blocked by the safety system. "
    "A placeholder image was used for that slide."
)
GENERIC_PROVIDER_ERROR_MESSAGE = (
    "The AI provider returned an error. Please try again."
)


_INVALID_API_KEY_PATTERNS = (
    re.compile(r"\binvalid[_\s-]*api[_\s-]*key\b", re.IGNORECASE),
    re.compile(r"\bincorrect\s+api\s+key\b", re.IGNORECASE),
    re.compile(r"\bapi\s+key\s+(?:is\s+)?invalid\b", re.IGNORECASE),
    re.compile(r"\bno\s+api\s+key\b", re.IGNORECASE),
    re.compile(r"\bauthentication(?:_error|\s+error)?\b", re.IGNORECASE),
)


def _normalize_code(value: Any) -> str:
    return str(value or "").strip().lower().replace("-", "_").replace(" ", "_")


def _stringify_for_detection(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (dict, list, tuple)):
        try:
            return json.dumps(value, ensure_ascii=False)
        except Exception:
            return str(value)
    return str(value)


def _combined_text(*values: Any) -> str:
    return " ".join(part for part in (_stringify_for_detection(v) for v in values) if part)


def looks_like_invalid_api_key_error(
    *,
    status_code: int | None = None,
    code: Any = None,
    error_type: Any = None,
    message: Any = None,
) -> bool:
    normalized_code = _normalize_code(code)
    normalized_type = _normalize_code(error_type)
    if normalized_code in {
        "invalid_api_key",
        "invalid_api_key_error",
        "authentication_error",
        "unauthorized",
    }:
        return True
    if normalized_type in {"authentication_error", "invalid_api_key"}:
        return True
    if status_code == 401:
        return True

    text = _combined_text(code, error_type, message)
    return any(pattern.search(text) for pattern in _INVALID_API_KEY_PATTERNS)


def _looks_like_moderation_block(
    *, code: Any = None, error_type: Any = None, message: Any = None
) -> bool:
    text = _combined_text(code, error_type, message).lower()
    return (
        _normalize_code(code) == "moderation_blocked"
        or "moderation_blocked" in text
        or ("safety system" in text and "image_generation" in text)
    )


def _looks_like_model_access_error(
    *, code: Any = None, message: Any = None
) -> bool:
    normalized_code = _normalize_code(code)
    if normalized_code in {"model_not_found", "model_not_available"}:
        return True

    text = _combined_text(code, message).lower()
    return "model" in text and (
        "not found" in text
        or "does not exist" in text
        or "do not have access" in text
        or "doesn't exist" in text
    )


def _provider_operation_prefix(provider: str, operation: str) -> str:
    provider_label = (provider or "AI provider").strip()
    operation_label = (operation or "request").strip()
    return f"{provider_label} {operation_label}"


def safe_provider_error_detail(
    provider: str,
    operation: str,
    *,
    status_code: int | None = None,
    code: Any = None,
    error_type: Any = None,
    message: Any = None,
) -> str:
    if looks_like_invalid_api_key_error(
        status_code=status_code,
        code=code,
        error_type=error_type,
        message=message,
    ):
        return INVALID_API_KEY_MESSAGE

    if _looks_like_moderation_block(
        code=code,
        error_type=error_type,
        message=message,
    ):
        if "image" in (operation or "").lower():
            return IMAGE_MODERATION_MESSAGE
        return (
            "The request was blocked by the provider's safety system. "
            "Please revise it and try again."
        )

    prefix = _provider_operation_prefix(provider, operation)
    normalized_code = _normalize_code(code)
    if normalized_code == "insufficient_quota":
        return (
            f"{prefix} failed because API quota is unavailable. "
            f"Check {provider} API billing and the limits for the project that owns this API key."
        )

    if status_code == 403:
        return (
            f"{provider} rejected the request because the configured API key does not "
            "have access. Check the key permissions and selected model."
        )

    if status_code == 429 or normalized_code in {"rate_limit_exceeded", "rate_limit"}:
        return f"{prefix} is temporarily rate limited. Please wait and try again."

    if _looks_like_model_access_error(code=code, message=message):
        return (
            f"The selected {provider} model is not available. "
            "Choose another model or check model access."
        )

    return f"{prefix} failed. Please try again."


def safe_llm_provider_error_detail(
    *,
    status_code: int | None = None,
    message: Any = None,
) -> str:
    if looks_like_invalid_api_key_error(status_code=status_code, message=message):
        return INVALID_API_KEY_MESSAGE

    text = _stringify_for_detection(message).strip()
    if not text:
        return GENERIC_PROVIDER_ERROR_MESSAGE

    looks_like_raw_provider_payload = (
        text.startswith("{")
        or text.startswith("[")
        or "{'error'" in text
        or '"error"' in text
        or "Error code:" in text
        or "http" in text.lower()
    )
    if looks_like_raw_provider_payload:
        return safe_provider_error_detail(
            "AI provider",
            "API request",
            status_code=status_code,
            message=text,
        )

    return text
