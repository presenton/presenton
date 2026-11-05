"""Classify provider failures without exposing endpoints, keys, or raw responses."""

import json
import socket
import ssl
from typing import Any

import aiohttp
import httpx
from fastapi import HTTPException
from openai import APIConnectionError, APITimeoutError
from llmai.shared.errors import LLMConnectionError

from utils.provider_error_messages import (
    looks_like_invalid_api_key_error,
    safe_provider_error_detail,
)


class ProviderHTTPException(HTTPException):
    def __init__(self, *, status_code: int, detail: str, code: str, retryable: bool, source: str):
        super().__init__(status_code=status_code, detail=detail)
        self.error_code = code
        self.retryable = retryable
        self.source = source


class ProviderResponseError(Exception):
    def __init__(self, status_code: int, body: Any):
        super().__init__(f"Provider returned HTTP {status_code}")
        self.status_code = status_code
        self.body = body


def _causes(error: Exception) -> list[BaseException]:
    result: list[BaseException] = []
    pending: list[BaseException] = [error]
    seen: set[int] = set()
    while pending and len(result) < 10:
        item = pending.pop(0)
        if id(item) in seen:
            continue
        seen.add(id(item))
        result.append(item)
        for name in ("cause", "__cause__", "__context__", "os_error"):
            cause = getattr(item, name, None)
            if isinstance(cause, BaseException):
                pending.append(cause)
    return result


def is_provider_failure(error: Exception) -> bool:
    return any(
        isinstance(item, (ProviderResponseError, httpx.HTTPError, aiohttp.ClientError, socket.gaierror))
        or type(item).__module__.startswith(("llmai.", "openai.", "google.genai.", "botocore."))
        for item in _causes(error)
    )


def normalize_provider_error(
    error: Exception, *, provider: str = "AI provider",
    operation: str = "API request", source: str = "llm",
) -> ProviderHTTPException:
    if isinstance(error, ProviderHTTPException):
        return error
    chain = _causes(error)
    status: int | None = None
    bodies: list[Any] = []
    for item in chain:
        for name in ("status_code", "status", "code"):
            value = getattr(item, name, None)
            if status is None and isinstance(value, int) and not isinstance(value, bool) and 400 <= value <= 599:
                status = value
        bodies.extend((getattr(item, "body", None), getattr(item, "message", None), getattr(item, "raw_message", None), str(item)))
    # Detection only: never include this text in the response or logs.
    text = " ".join(str(body)[:16000] for body in bodies if body is not None).lower()
    code = "provider_error"
    retryable = False
    detection_code: str | None = None

    if any(marker in text for marker in (
        "context_length_exceeded", "maximum context length", "prompt is too long",
        "input_too_long", "exceeds the context window", "input token count exceeds",
    )):
        code, status = "context_window_exceeded", 422
    elif looks_like_invalid_api_key_error(status_code=status, message=text):
        code, detection_code, status = "provider_authentication_failed", "invalid_api_key", status or 401
    elif "insufficient_quota" in text or "quota exceeded" in text or "quota_exceeded" in text:
        code, detection_code, status = "provider_quota_exceeded", "insufficient_quota", status or 429
    elif any(isinstance(item, socket.gaierror) for item in chain) or any(marker in text for marker in (
        "getaddrinfo failed", "name or service not known", "nodename nor servname",
        "temporary failure in name resolution", "dns resolution failed", "cannot resolve host",
    )):
        code, status, retryable = "provider_dns_error", 503, True
    elif any(isinstance(item, (TimeoutError, httpx.TimeoutException, APITimeoutError)) for item in chain) or any(marker in text for marker in (
        "request timed out", "connection timed out", "workflow timed out", "read timeout", "connect timeout",
    )) or status in {408, 504}:
        code, status, retryable = "provider_timeout", 504, True
    elif any(isinstance(item, (ssl.SSLError, aiohttp.ClientSSLError)) for item in chain):
        code, status = "provider_tls_error", 502
    elif any(isinstance(item, (ConnectionError, httpx.ConnectError, aiohttp.ClientConnectionError, APIConnectionError, LLMConnectionError)) for item in chain):
        code, status, retryable = "provider_unreachable", 503, True
    elif status == 403:
        code = "provider_permission_denied"
    elif "model_not_found" in text or "model_not_available" in text or (
        "model" in text and any(marker in text for marker in ("does not exist", "not found", "do not have access"))
    ):
        code, detection_code, status = "provider_model_unavailable", "model_not_found", status or 400
    elif status == 429 or "rate_limit_exceeded" in text:
        code, status, retryable = "provider_rate_limited", 429, True
    elif status == 404:
        code = "provider_endpoint_not_found"
    elif any(isinstance(item, (json.JSONDecodeError, httpx.DecodingError, aiohttp.ContentTypeError)) for item in chain) or "invalid_response" in text:
        code, status, retryable = "provider_invalid_response", 502, True
    elif any(marker in text for marker in ("moderation_blocked", "safety system", "content_policy_violation")):
        code, detection_code, status = "provider_safety_blocked", "moderation_blocked", status or 400
    elif status is not None and status >= 500:
        code, retryable = "provider_unavailable", True
    elif any(marker in text for marker in ("environment variable is not set", "api key is not set", "configuration_error")):
        code, status = "provider_configuration_error", 400
    elif status in {400, 422}:
        code = "provider_request_rejected"

    return ProviderHTTPException(
        status_code=status or 502,
        detail=safe_provider_error_detail(
            provider, operation, status_code=status,
            code=detection_code or code, message=text,
        ),
        code=code, retryable=retryable, source=source,
    )
