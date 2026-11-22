import asyncio
import json
import socket
import ssl
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from llmai.shared.errors import BaseError
from pydantic import BaseModel

from api.v1.ppt.endpoints import chat
from models.chat import ChatMessageRequest
from services.image_generation_service import ImageGenerationService
from utils.api_errors import register_error_handlers
from utils.llm_client_error_handler import handle_llm_client_exceptions
from utils.provider_errors import ProviderResponseError, normalize_provider_error
from utils.sse import safe_sse_stream


@pytest.mark.parametrize(("error", "code", "status", "retryable"), [
    (socket.gaierror(-2, "hostname secret.internal"), "provider_dns_error", 503, True),
    (httpx.ConnectError("http://user:secret@internal/private"), "provider_unreachable", 503, True),
    (httpx.ReadTimeout("secret prompt"), "provider_timeout", 504, True),
    (TimeoutError("secret prompt"), "provider_timeout", 504, True),
    (ssl.SSLCertVerificationError("private certificate"), "provider_tls_error", 502, False),
    (ProviderResponseError(401, {"error": "sk-private-secret"}), "provider_authentication_failed", 401, False),
    (ProviderResponseError(403, "private ACL"), "provider_permission_denied", 403, False),
    (ProviderResponseError(429, {"error": {"code": "insufficient_quota"}}), "provider_quota_exceeded", 429, False),
    (ProviderResponseError(429, "too many requests"), "provider_rate_limited", 429, True),
    (ProviderResponseError(404, {"error": {"code": "model_not_found"}}), "provider_model_unavailable", 404, False),
    (ProviderResponseError(404, "Not Found"), "provider_endpoint_not_found", 404, False),
    (ProviderResponseError(400, {"error": {"code": "context_length_exceeded"}}), "context_window_exceeded", 422, False),
    (json.JSONDecodeError("private payload", "secret", 0), "provider_invalid_response", 502, True),
    (ProviderResponseError(503, "secret backend trace"), "provider_unavailable", 503, True),
    (ProviderResponseError(400, "moderation_blocked"), "provider_safety_blocked", 400, False),
    (ProviderResponseError(400, "invalid parameters secret"), "provider_request_rejected", 400, False),
    (ValueError("private prompt"), "provider_error", 502, False),
])
def test_provider_failure_categories_are_safe(error, code, status, retryable):
    normalized = normalize_provider_error(error)
    assert normalized.error_code == code
    assert normalized.status_code == status
    assert normalized.retryable is retryable
    assert all(value not in normalized.detail for value in ("secret", "private", "http://", "internal/"))


def test_llmai_wrapped_dns_cause_is_preserved_and_not_logged(caplog):
    cause = socket.gaierror(-2, "secret host cannot resolve")
    wrapped = BaseError(500, "secret provider response", cause=cause)
    error = handle_llm_client_exceptions(wrapped)
    assert error.error_code == "provider_dns_error"
    assert "secret" not in caplog.text
    assert "hostname" in error.detail


def test_codex_reauth_keeps_action_header_and_hides_provider_message(monkeypatch):
    from enums.llm_provider import LLMProvider
    monkeypatch.setattr("utils.llm_client_error_handler.get_llm_provider", lambda: LLMProvider.CODEX)
    error = handle_llm_client_exceptions(BaseError(401, "expired token secret"))
    assert error.headers == {"X-Presenton-Auth-Action": "codex-reauth"}
    assert error.error_code == "chatgpt_auth_required"
    assert "CHATGPT_AUTH_REQUIRED:" in error.detail
    assert "secret" not in error.detail


class _Config(BaseModel):
    api_key: int


def _app():
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/healthy")
    async def healthy():
        return {"ok": True}

    @app.get("/broken")
    async def broken():
        raise RuntimeError("sk-secret-database-password")

    @app.get("/provider")
    async def provider():
        raise normalize_provider_error(httpx.ReadTimeout("secret prompt"))

    @app.get("/auth")
    async def auth():
        raise HTTPException(401, "Sign in required", headers={"WWW-Authenticate": "Bearer"})

    @app.post("/config")
    async def config(body: _Config):
        return body

    return app


def test_http_errors_have_consistent_metadata_and_server_survives_failure(caplog):
    client = TestClient(_app())
    response = client.get("/broken")
    assert response.status_code == 500
    assert response.json()["code"] == "internal_error"
    assert response.json()["request_id"] == response.headers["X-Request-ID"]
    assert "sk-secret" not in response.text
    assert "sk-secret" not in caplog.text
    assert client.get("/healthy").json() == {"ok": True}
    provider = client.get("/provider")
    assert provider.status_code == 504
    assert provider.json()["code"] == "provider_timeout"
    assert provider.json()["retryable"] is True
    assert "secret" not in provider.text
    auth = client.get("/auth")
    assert auth.headers["WWW-Authenticate"] == "Bearer"
    assert auth.json()["code"] == "authentication_required"
    assert auth.json()["detail"] == "Sign in required"


def test_validation_response_does_not_echo_credentials():
    response = TestClient(_app()).post("/config", json={"api_key": "sk-secret"})
    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert response.json()["detail"][0]["loc"] == ["body", "api_key"]
    assert "sk-secret" not in response.text
    assert "input" not in response.json()["detail"][0]


def test_structured_application_error_keeps_message_and_non_retryable_policy():
    app = _app()
    detail = {
        "code": "community_service_url_invalid",
        "message": "The Community service URL is invalid. Check PRESENTON_COMMUNITY_API_URL.",
        "retryable": False,
    }

    @app.get("/community-error")
    async def community_error():
        raise HTTPException(500, detail)

    response = TestClient(app).get("/community-error")
    assert response.status_code == 500
    assert response.json()["detail"] == detail
    assert response.json()["code"] == "community_service_url_invalid"
    assert response.json()["retryable"] is False


def _data(frame):
    return json.loads(frame.split("data: ", 1)[1].strip())


def test_stream_provider_failure_keeps_metadata_even_when_cleanup_fails():
    async def stream():
        yield "initial frame"
        raise normalize_provider_error(ProviderResponseError(429, "insufficient_quota"))

    async def metadata(_error):
        return {"completed_slides": 2, "total_slides": 5, "retryable": True}

    async def collect():
        return [frame async for frame in safe_sse_stream(
            stream(), logger=Mock(), error_detail="Failed",
            on_error=AsyncMock(side_effect=RuntimeError("cleanup secret")), error_metadata=metadata,
        )]

    frames = asyncio.run(collect())
    error = _data(frames[-1])
    assert frames[0] == "initial frame"
    assert error["code"] == "provider_quota_exceeded"
    assert error["retryable"] is False
    assert error["completed_slides"] == 2
    assert "secret" not in str(error)


def test_stream_cancellation_cleans_up_without_sending_error():
    cleanup = AsyncMock()
    closed = []

    async def stream():
        try:
            raise asyncio.CancelledError
            yield ""  # pragma: no cover
        finally:
            closed.append(True)

    async def collect():
        return [frame async for frame in safe_sse_stream(stream(), logger=Mock(), error_detail="Failed", on_error=cleanup)]

    assert asyncio.run(collect()) == []
    cleanup.assert_awaited_once()
    assert closed == [True]


def test_chat_stream_catches_unexpected_failure_and_rolls_back(monkeypatch):
    async def stream(*_args):
        yield "chunk", "Partial reply"
        raise RuntimeError("secret provider payload")

    monkeypatch.setattr(chat, "PresentationChatService", lambda **kwargs: SimpleNamespace(stream_reply=stream))
    session = SimpleNamespace(rollback=AsyncMock())

    async def collect():
        response = await chat.chat_message_stream(ChatMessageRequest(presentation_id=uuid.uuid4(), message="Edit title"), session)
        return [frame async for frame in response.body_iterator]

    frames = asyncio.run(collect())
    assert _data(frames[0])["chunk"] == "Partial reply"
    assert _data(frames[-1])["code"] == "internal_error"
    assert "secret" not in frames[-1]
    session.rollback.assert_awaited_once()


def test_comfyui_polling_stops_on_auth_failure_instead_of_waiting(monkeypatch):
    monkeypatch.setattr("services.image_generation_service.asyncio.sleep", AsyncMock())
    response = SimpleNamespace(status=401, text=AsyncMock(return_value="secret raw key"))
    session = SimpleNamespace(get=AsyncMock(return_value=response))
    service = object.__new__(ImageGenerationService)
    with pytest.raises(HTTPException) as caught:
        asyncio.run(service._wait_for_comfyui_completion(session, "http://comfyui", "prompt"))
    assert caught.value.error_code == "provider_authentication_failed"
    assert "secret" not in caught.value.detail
    session.get.assert_awaited_once()


def test_comfyui_error_status_is_not_mistaken_for_success(monkeypatch):
    monkeypatch.setattr("services.image_generation_service.asyncio.sleep", AsyncMock())
    response = SimpleNamespace(status=200, json=AsyncMock(return_value={
        "prompt": {"status": {"status_str": "error", "completed": True, "messages": ["secret workflow"]}},
    }))
    session = SimpleNamespace(get=AsyncMock(return_value=response))
    service = object.__new__(ImageGenerationService)
    with pytest.raises(HTTPException) as caught:
        asyncio.run(service._wait_for_comfyui_completion(session, "http://comfyui", "prompt"))
    assert caught.value.error_code == "provider_request_rejected"
    assert caught.value.retryable is False
    assert "secret" not in caught.value.detail
    session.get.assert_awaited_once()
