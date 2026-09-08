import asyncio
import json
import uuid

import pytest
from starlette.requests import Request
from starlette.responses import Response

from api import middlewares
from api.middlewares import SessionAuthMiddleware
from api.v1.auth.principal import AuthPrincipal


def test_only_shared_app_data_asset_prefixes_do_not_require_auth():
    middleware = SessionAuthMiddleware(app=None)

    assert middleware._requires_auth("/app_data/images/photo.png") is True
    assert middleware._requires_auth("/app_data/fonts/embedded/font.ttf") is False
    assert (
        middleware._requires_auth("/app_data/pptx-to-html/session/fonts/font.ttf")
        is True
    )
    assert (
        middleware._requires_auth("/app_data/templates/default/thumbnail.png") is False
    )
    assert (
        middleware._requires_auth("/app_data/pptx-to-html/session/images/image.png")
        is True
    )


def test_other_app_data_prefixes_still_require_auth():
    middleware = SessionAuthMiddleware(app=None)

    assert middleware._requires_auth("/app_data/uploads/source.pptx") is True
    assert middleware._requires_auth("/app_data/exports/deck.pdf") is True


def test_presenton_provider_endpoints_require_a_local_session():
    middleware = SessionAuthMiddleware(app=None)

    assert middleware._requires_auth("/api/v1/auth/presenton/status") is True
    assert middleware._requires_auth("/api/v1/auth/presenton/device/start") is True
    assert middleware._requires_auth("/api/v1/auth/presenton/device/poll") is True


def test_auth_disabled_runtime_still_checks_presenton_cloud_proxy(monkeypatch):
    captured = {}

    class SessionContext:
        async def __aenter__(self):
            return "desktop-session"

        async def __aexit__(self, *_args):
            return None

    async def proxy(request, session, user, **kwargs):
        captured.update(request=request, session=session, user=user, kwargs=kwargs)
        return Response("cloud-response")

    async def unexpected_next(_request):
        raise AssertionError("A cloud response must bypass the local route")

    monkeypatch.setattr(middlewares, "is_disable_auth_enabled", lambda: True)
    monkeypatch.setattr(middlewares, "async_session_maker", SessionContext)
    monkeypatch.setattr(
        middlewares,
        "maybe_proxy_presenton_cloud_request",
        proxy,
    )

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "scheme": "http",
            "path": "/api/v1/ppt/presentation/create",
            "query_string": b"",
            "headers": [],
            "client": ("127.0.0.1", 1234),
            "server": ("127.0.0.1", 5001),
        }
    )
    response = asyncio.run(
        SessionAuthMiddleware(app=None).dispatch(request, unexpected_next)
    )

    assert response.body == b"cloud-response"
    assert captured["session"] == "desktop-session"
    assert captured["user"] is None
    assert captured["kwargs"] == {"allow_unowned": True}


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/ppt/template/mcp-upload",
        "/api/v1/ppt/template/init",
        "/api/v1/ppt/template/async",
    ],
)
def test_template_generation_routes_allow_authenticated_normal_users(monkeypatch, path):
    class Session:
        async def scalar(self, _query):
            return 1

    class SessionContext:
        async def __aenter__(self):
            return Session()

        async def __aexit__(self, *_args):
            return None

    user_id = uuid.uuid4()

    async def resolve_principal(_request, _session):
        return (
            AuthPrincipal(
                user_id=user_id,
                username="normal-user",
                is_admin=False,
                method="jwt",
            ),
            object(),
        )

    async def call_next(request):
        assert request.state.auth_principal.user_id == user_id
        assert request.state.auth_principal.is_admin is False
        return Response("template route reached", status_code=200)

    async def no_cloud_proxy(*_args, **_kwargs):
        return None

    monkeypatch.setattr(middlewares, "is_disable_auth_enabled", lambda: False)
    monkeypatch.setattr(middlewares, "async_session_maker", SessionContext)
    monkeypatch.setattr(middlewares, "resolve_request_principal", resolve_principal)
    monkeypatch.setattr(
        middlewares, "maybe_proxy_presenton_cloud_request", no_cloud_proxy
    )
    request = Request(
        {
            "type": "http",
            "method": "POST",
            "scheme": "http",
            "path": path,
            "query_string": b"",
            "headers": [],
            "client": ("127.0.0.1", 1234),
            "server": ("127.0.0.1", 5001),
        }
    )

    response = asyncio.run(
        SessionAuthMiddleware(app=None).dispatch(request, call_next)
    )

    assert response.status_code == 200
    assert response.body == b"template route reached"


def test_api_keys_cannot_access_browser_admin_routes(monkeypatch):
    class Session:
        async def scalar(self, _query):
            return 1

    class SessionContext:
        async def __aenter__(self):
            return Session()

        async def __aexit__(self, *_args):
            return None

    async def resolve_principal(_request, _session):
        return (
            AuthPrincipal(
                user_id=uuid.uuid4(),
                username="admin",
                is_admin=True,
                method="api_key",
            ),
            object(),
        )

    async def unexpected_next(_request):
        raise AssertionError("API keys must not reach admin configuration routes")

    monkeypatch.setattr(middlewares, "is_disable_auth_enabled", lambda: False)
    monkeypatch.setattr(middlewares, "async_session_maker", SessionContext)
    monkeypatch.setattr(middlewares, "resolve_request_principal", resolve_principal)
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "scheme": "http",
            "path": "/api/v1/admin/provider-settings",
            "query_string": b"",
            "headers": [],
            "client": ("127.0.0.1", 1234),
            "server": ("127.0.0.1", 5001),
        }
    )

    response = asyncio.run(
        SessionAuthMiddleware(app=None).dispatch(request, unexpected_next)
    )

    assert response.status_code == 403
    assert json.loads(response.body) == {"detail": "Admin browser session required"}
