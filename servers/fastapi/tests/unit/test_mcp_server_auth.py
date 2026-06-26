import asyncio
from types import SimpleNamespace

import httpx

import mcp_server


def test_is_mcp_server_enabled_in_server_deployments(monkeypatch):
    monkeypatch.setattr(mcp_server, "is_presenton_electron_desktop", lambda: False)

    assert mcp_server.is_mcp_server_enabled() is True


def test_is_mcp_server_disabled_in_electron_desktop(monkeypatch):
    monkeypatch.setattr(mcp_server, "is_presenton_electron_desktop", lambda: True)

    assert mcp_server.is_mcp_server_enabled() is False


def test_create_mcp_auth_provider_disabled_when_auth_is_disabled(monkeypatch):
    monkeypatch.setattr(mcp_server, "is_disable_auth_enabled", lambda: True)
    monkeypatch.setattr(mcp_server, "is_auth_configured", lambda: True)

    assert mcp_server.create_mcp_auth_provider() is None


def test_create_mcp_auth_provider_disabled_when_auth_not_configured(monkeypatch):
    monkeypatch.setattr(mcp_server, "is_disable_auth_enabled", lambda: False)
    monkeypatch.setattr(mcp_server, "is_auth_configured", lambda: False)

    assert mcp_server.create_mcp_auth_provider() is None


def test_create_mcp_auth_provider_enabled_when_auth_configured(monkeypatch):
    monkeypatch.setattr(mcp_server, "is_disable_auth_enabled", lambda: False)
    monkeypatch.setattr(mcp_server, "is_auth_configured", lambda: True)

    provider = mcp_server.create_mcp_auth_provider()
    assert isinstance(provider, mcp_server.PresentonTokenVerifier)


def test_presenton_token_verifier_accepts_valid_token(monkeypatch):
    monkeypatch.setattr(
        mcp_server,
        "validate_session_token",
        lambda token: "admin" if token == "valid-token" else None,
    )
    verifier = mcp_server.PresentonTokenVerifier()

    access_token = asyncio.run(verifier.verify_token("valid-token"))

    assert access_token is not None
    assert access_token.token == "valid-token"
    assert access_token.client_id == "admin"
    assert access_token.claims["u"] == "admin"


def test_presenton_token_verifier_rejects_invalid_token(monkeypatch):
    monkeypatch.setattr(mcp_server, "validate_session_token", lambda _token: None)
    verifier = mcp_server.PresentonTokenVerifier()

    access_token = asyncio.run(verifier.verify_token("invalid-token"))

    assert access_token is None


def test_attach_request_auth_header_uses_authenticated_mcp_token(monkeypatch):
    monkeypatch.setattr(
        mcp_server,
        "get_access_token",
        lambda: SimpleNamespace(token="session-abc"),
    )
    request = httpx.Request("POST", "http://127.0.0.1:8000/api/v1/example")

    asyncio.run(mcp_server.attach_request_auth_header(request))

    assert request.headers["Authorization"] == "Bearer session-abc"


def test_attach_request_auth_header_keeps_existing_auth_header(monkeypatch):
    monkeypatch.setattr(
        mcp_server,
        "get_access_token",
        lambda: SimpleNamespace(token="session-abc"),
    )
    request = httpx.Request(
        "POST",
        "http://127.0.0.1:8000/api/v1/example",
        headers={"Authorization": "Bearer existing"},
    )

    asyncio.run(mcp_server.attach_request_auth_header(request))

    assert request.headers["Authorization"] == "Bearer existing"


def test_attach_request_auth_header_skips_when_no_mcp_access_token(monkeypatch):
    monkeypatch.setattr(mcp_server, "get_access_token", lambda: None)
    monkeypatch.setattr(mcp_server, "get_http_headers", lambda include=None: {})
    request = httpx.Request("POST", "http://127.0.0.1:8000/api/v1/example")

    asyncio.run(mcp_server.attach_request_auth_header(request))

    assert "Authorization" not in request.headers


def test_attach_request_auth_header_forwards_incoming_authorization_header(monkeypatch):
    monkeypatch.setattr(mcp_server, "get_access_token", lambda: None)
    monkeypatch.setattr(
        mcp_server,
        "get_http_headers",
        lambda include=None: {"authorization": "Basic YWRtaW46c2VjcmV0MTIz"},
    )
    request = httpx.Request("POST", "http://127.0.0.1:8000/api/v1/example")

    asyncio.run(mcp_server.attach_request_auth_header(request))

    assert request.headers["Authorization"].startswith("Basic ")


def test_get_mcp_api_timeout_supports_long_running_requests():
    timeout = mcp_server.get_mcp_api_timeout()

    assert timeout.read >= 300
    assert timeout.write >= 300
    assert timeout.pool >= 300
    assert timeout.connect == mcp_server.MCP_API_CONNECT_TIMEOUT_SECONDS
