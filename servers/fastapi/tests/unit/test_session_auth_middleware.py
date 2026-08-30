import asyncio

from starlette.requests import Request
from starlette.responses import Response

from api import middlewares
from api.middlewares import SessionAuthMiddleware


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
