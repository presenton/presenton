"""Safe, compatible JSON errors for HTTP responses and streaming events."""

import logging
import traceback
import uuid
from typing import Any, Awaitable, Callable

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from utils.provider_errors import ProviderHTTPException, is_provider_failure, normalize_provider_error


LOGGER = logging.getLogger(__name__)
SERVER_ERROR_MESSAGE = "The server could not complete this request. Please try again. If it keeps failing, contact your administrator."
STATUS_CODES = {
    400: "invalid_request", 401: "authentication_required", 403: "permission_denied",
    404: "not_found", 409: "conflict", 413: "request_too_large",
    415: "unsupported_media_type", 422: "validation_error", 429: "rate_limited",
    502: "bad_gateway", 503: "service_unavailable", 504: "request_timeout",
}


class ApiErrorBoundary:
    """Contain unexpected request failures before response headers are sent."""

    def __init__(self, app: ASGIApp, on_error: Callable[[Request, Exception], Awaitable[JSONResponse]]):
        self.app = app
        self.on_error = on_error

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        started = False

        async def tracked_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, tracked_send)
        except Exception as error:
            if started:
                # Streaming endpoints must use safe_sse_stream: HTTP status and
                # JSON cannot be replaced after a response has already started.
                raise
            response = await self.on_error(Request(scope), error)
            await response(scope, receive, send)


def api_error_payload(
    error: Exception, *, fallback_detail: str = SERVER_ERROR_MESSAGE,
    source: str = "server",
) -> dict[str, Any]:
    if not isinstance(error, HTTPException) and (source != "server" or is_provider_failure(error)):
        normalized = normalize_provider_error(error, source=source)
        # Unknown failures are application errors, not fabricated provider errors.
        if normalized.error_code != "provider_error":
            error = normalized
    if isinstance(error, HTTPException):
        status = error.status_code
        structured = (
            isinstance(error.detail, dict)
            and set(error.detail) == {"code", "message", "retryable"}
            and isinstance(error.detail["code"], str)
            and isinstance(error.detail["message"], str)
            and isinstance(error.detail["retryable"], bool)
        )
        # Existing application errors (for example Community) already use this
        # explicit envelope. Keep their message and non-retryable policy intact.
        detail = error.detail if status < 500 or isinstance(error, ProviderHTTPException) or structured else fallback_detail
    else:
        status, detail = 500, fallback_detail
    nested = detail if isinstance(detail, dict) else {}
    code = getattr(error, "error_code", None) or nested.get("code") or STATUS_CODES.get(status, "internal_error")
    if not isinstance(code, str) or len(code) > 100:
        code = STATUS_CODES.get(status, "internal_error")
    if status == 422 and isinstance(detail, str) and not getattr(error, "error_code", None):
        if "context window" in detail.lower():
            code = "context_window_exceeded"
        elif "response was incomplete" in detail.lower():
            code = "provider_response_incomplete"
    retryable = getattr(error, "retryable", nested.get("retryable", status in {408, 425, 429, 500, 502, 503, 504}))
    return {
        "detail": detail, "code": code, "status_code": status,
        "retryable": bool(retryable), "source": getattr(error, "source", source),
    }


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_error(_request: Request, error: HTTPException):
        return JSONResponse(
            status_code=error.status_code,
            content=api_error_payload(error), headers=error.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_request: Request, error: RequestValidationError):
        # Pydantic's default response includes input values and ctx; configuration
        # requests can contain credentials. Return only field/error descriptions.
        detail = [
            {key: item[key] for key in ("loc", "msg", "type") if key in item}
            for item in error.errors()
        ]
        return JSONResponse(status_code=422, content={
            "detail": detail, "code": "validation_error", "retryable": False,
            "status_code": 422,
        })

    @app.exception_handler(Exception)
    async def unexpected_error(_request: Request, error: Exception):
        request_id = uuid.uuid4().hex
        # Stack frames aid debugging without logging provider bodies, prompts,
        # exception messages or locals that can contain credentials.
        frames = [f"{frame.filename}:{frame.lineno} in {frame.name}" for frame in traceback.extract_tb(error.__traceback__)]
        LOGGER.error("Request failed: request_id=%s exception=%s stack=%s", request_id, type(error).__name__, " -> ".join(frames))
        payload = api_error_payload(error)
        payload["request_id"] = request_id
        return JSONResponse(
            status_code=payload["status_code"], content=payload,
            headers={"X-Request-ID": request_id},
        )

    app.add_middleware(ApiErrorBoundary, on_error=unexpected_error)
