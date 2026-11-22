import logging

from fastapi import HTTPException

from enums.llm_provider import LLMProvider
from utils.llm_provider import get_llm_provider
from utils.provider_errors import ProviderHTTPException, normalize_provider_error


LOGGER = logging.getLogger(__name__)
CHATGPT_AUTH_REQUIRED_HEADER = {"X-Presenton-Auth-Action": "codex-reauth"}
CHATGPT_AUTH_REQUIRED_PREFIX = "CHATGPT_AUTH_REQUIRED:"


def _is_codex_provider() -> bool:
    try:
        return get_llm_provider() == LLMProvider.CODEX
    except Exception:
        return False


def _chatgpt_auth_required_exception() -> HTTPException:
    error = ProviderHTTPException(
        status_code=401,
        detail=f"{CHATGPT_AUTH_REQUIRED_PREFIX} Your ChatGPT session expired. Please sign in again from Settings.",
        code="chatgpt_auth_required", retryable=False, source="llm",
    )
    error.headers = CHATGPT_AUTH_REQUIRED_HEADER
    return error


def handle_llm_client_exceptions(e: Exception) -> HTTPException:
    if isinstance(e, HTTPException):
        if _is_codex_provider() and e.status_code in {401, 403}:
            return _chatgpt_auth_required_exception()
        return e
    error = normalize_provider_error(e)
    if _is_codex_provider() and error.status_code in {401, 403}:
        return _chatgpt_auth_required_exception()
    LOGGER.warning("LLM request failed: code=%s status=%s exception=%s", error.error_code, error.status_code, type(e).__name__)
    return error
