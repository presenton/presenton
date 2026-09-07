import asyncio

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api.v1.auth import presenton_oauth
from api.v1.auth.router import API_V1_AUTH_ROUTER
from api.v1.auth.users import PASSWORD_HELPER
from models.sql.presenton_cloud_provider import PresentonCloudProvider
from models.sql.provider_settings import ProviderSettings
from models.sql.user import User
from services.database import get_async_session
from utils.get_env import get_presenton_oauth_issuer


def _build_client(tmp_path) -> tuple[TestClient, object, object]:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'oauth.db'}")
    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    async def create_tables():
        async with engine.begin() as connection:
            await connection.run_sync(User.__table__.create)
            await connection.run_sync(PresentonCloudProvider.__table__.create)
            await connection.run_sync(ProviderSettings.__table__.create)

    asyncio.run(create_tables())

    async def override_session():
        async with session_maker() as session:
            yield session

    app = FastAPI()
    app.include_router(API_V1_AUTH_ROUTER)
    app.dependency_overrides[get_async_session] = override_session
    return TestClient(app), engine, session_maker


def _response(status_code: int, payload: dict) -> httpx.Response:
    return httpx.Response(status_code, json=payload)


def _login_admin(client: TestClient) -> None:
    setup = client.post(
        "/api/v1/auth/setup",
        json={"username": "local-admin", "password": "secret123"},
    )
    assert setup.status_code == 200
    login = client.post(
        "/api/v1/auth/login",
        json={"username": "local-admin", "password": "secret123"},
    )
    assert login.status_code == 200


def test_presenton_provider_connection_requires_local_admin(monkeypatch, tmp_path):
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    client, engine, _session_maker = _build_client(tmp_path)

    assert (
        client.post(
            "/api/v1/auth/presenton/device/start",
            json={"device_name": "Test device"},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/auth/presenton/device/poll",
            json={"device_code": "device-code-secret-12345"},
        ).status_code
        == 401
    )
    assert client.post("/api/v1/auth/presenton/logout").status_code == 401
    asyncio.run(engine.dispose())


def test_auth_disabled_runtime_can_manage_presenton_provider(monkeypatch, tmp_path):
    monkeypatch.setenv("DISABLE_AUTH", "true")
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    client, engine, _session_maker = _build_client(tmp_path)

    status = client.get("/api/v1/auth/presenton/status")
    assert status.status_code == 200
    assert status.json()["can_manage"] is True

    async def provider_request(_method, url, **_kwargs):
        if url.endswith("/oauth/device_authorization"):
            return _response(
                200,
                {
                    "device_code": "device-code-secret-12345",
                    "user_code": "BCDF-GHJK",
                    "verification_uri": "https://presenton.test/device",
                    "verification_uri_complete": "https://presenton.test/device",
                    "expires_in": 900,
                    "interval": 5,
                },
            )
        if url.endswith("/oauth/token"):
            return _response(
                200,
                {
                    "access_token": "desktop.jwt.signature",
                    "expires_in": 3600,
                },
            )
        if url.endswith("/oauth/userinfo"):
            return _response(
                200,
                {
                    "sub": "desktop-provider-owner",
                    "email": "desktop@example.com",
                },
            )
        if url.endswith("/oauth/revoke"):
            return _response(200, {})
        raise AssertionError(f"Unexpected provider URL: {url}")

    monkeypatch.setattr(presenton_oauth, "_provider_request", provider_request)
    started = client.post(
        "/api/v1/auth/presenton/device/start",
        json={"device_name": "Presenton desktop"},
    )
    assert started.status_code == 200
    assert started.json()["verification_uri"] == "https://presenton.test/device"

    connected = client.post(
        "/api/v1/auth/presenton/device/poll",
        json={"device_code": "device-code-secret-12345"},
    )
    assert connected.status_code == 200
    status = client.get("/api/v1/auth/presenton/status").json()
    assert status["linked"] is True
    assert status["email"] == "desktop@example.com"

    assert client.post("/api/v1/auth/presenton/logout").status_code == 200
    assert client.get("/api/v1/auth/presenton/status").json()["linked"] is False
    asyncio.run(engine.dispose())


def test_admin_connects_global_provider_without_replacing_local_login(monkeypatch, tmp_path):
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    client, engine, session_maker = _build_client(tmp_path)
    _login_admin(client)

    async def provider_request(method, url, **kwargs):
        if url.endswith("/oauth/device_authorization"):
            assert kwargs["data"]["client_id"] == "ptc_presenton_open_source"
            assert "scope" not in kwargs["data"]
            return _response(
                200,
                {
                    "device_code": "device-code-secret-12345",
                    "user_code": "BCDF-GHJK",
                    "verification_uri": "https://presenton.test/device",
                    "verification_uri_complete": "https://presenton.test/device?user_code=BCDF-GHJK",
                    "expires_in": 900,
                    "interval": 5,
                },
            )
        if url.endswith("/oauth/token"):
            return _response(
                200,
                {
                    "access_token": "user.jwt.signature",
                    "expires_in": 30 * 24 * 60 * 60,
                },
            )
        if url.endswith("/oauth/userinfo"):
            return _response(
                200,
                {
                    "sub": "hosted-provider-owner",
                    "email": "provider@example.com",
                },
            )
        raise AssertionError(f"Unexpected provider URL: {method} {url}")

    monkeypatch.setattr(presenton_oauth, "_provider_request", provider_request)
    started = client.post(
        "/api/v1/auth/presenton/device/start",
        json={"device_name": "Test device"},
    )
    assert started.json()["verification_uri"] == "https://presenton.test/device"
    assert started.json()["verification_uri_complete"] == "https://presenton.test/device"
    assert "user_code" not in started.json()["verification_uri_complete"]
    connected = client.post(
        "/api/v1/auth/presenton/device/poll",
        json={"device_code": "device-code-secret-12345"},
    )

    assert started.status_code == 200
    assert connected.status_code == 200
    assert connected.json() == {
        "status": "authorized",
        "connected": True,
        "email": "provider@example.com",
    }
    local_auth = client.get("/api/v1/auth/status").json()
    assert local_auth["authenticated"] is True
    assert local_auth["username"] == "local-admin"

    status = client.get("/api/v1/auth/presenton/status").json()
    assert status["linked"] is True
    assert status["can_manage"] is True
    assert status["email"] == "provider@example.com"

    async def rows():
        async with session_maker() as session:
            user_count = int(await session.scalar(select(func.count()).select_from(User)) or 0)
            provider = await session.scalar(select(PresentonCloudProvider))
            return user_count, provider

    user_count, provider = asyncio.run(rows())
    assert user_count == 1
    assert provider.subject == "hosted-provider-owner"
    assert provider.access_token_encrypted != "user.jwt.signature"
    asyncio.run(engine.dispose())


def test_admin_provider_poll_reports_pending_authorization(monkeypatch, tmp_path):
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    client, engine, _session_maker = _build_client(tmp_path)
    _login_admin(client)

    async def provider_request(_method, url, **_kwargs):
        assert url.endswith("/oauth/token")
        return _response(400, {"error": "authorization_pending"})

    monkeypatch.setattr(presenton_oauth, "_provider_request", provider_request)
    response = client.post(
        "/api/v1/auth/presenton/device/poll",
        json={"device_code": "device-code-secret-12345"},
    )

    assert response.status_code == 202
    assert response.json() == {
        "status": "pending",
        "error": "authorization_pending",
    }
    asyncio.run(engine.dispose())


def test_admin_can_disconnect_global_provider(monkeypatch, tmp_path):
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    client, engine, session_maker = _build_client(tmp_path)
    _login_admin(client)

    async def seed_provider():
        async with session_maker() as session:
            session.add(ProviderSettings(id=1, config={"LLM": "presenton"}))
            await session.commit()
            await presenton_oauth.store_presenton_credentials(
                session,
                issuer=get_presenton_oauth_issuer(),
                subject="hosted-provider-owner",
                email="provider@example.com",
                access_token="user.jwt.signature",
                expires_in=3600,
            )

    asyncio.run(seed_provider())

    async def provider_request(_method, url, **kwargs):
        assert url.endswith("/oauth/revoke")
        assert kwargs["headers"]["Authorization"] == "Bearer user.jwt.signature"
        return _response(200, {})

    monkeypatch.setattr(presenton_oauth, "_provider_request", provider_request)
    response = client.post("/api/v1/auth/presenton/logout")

    assert response.status_code == 200
    assert client.get("/api/v1/auth/presenton/status").json()["linked"] is False

    async def selected_provider():
        async with session_maker() as session:
            settings = await session.get(ProviderSettings, 1)
            return settings.config["LLM"]

    assert asyncio.run(selected_provider()) is None
    asyncio.run(engine.dispose())


def test_regular_user_cannot_manage_global_provider(monkeypatch, tmp_path):
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    client, engine, session_maker = _build_client(tmp_path)
    _login_admin(client)

    async def create_member():
        async with session_maker() as session:
            session.add(
                User(
                    username="member",
                    hashed_password=PASSWORD_HELPER.hash("member123"),
                    is_active=True,
                    is_verified=True,
                    is_superuser=False,
                    auth_version=1,
                )
            )
            await session.commit()

    asyncio.run(create_member())
    client.cookies.clear()
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"username": "member", "password": "member123"},
        ).status_code
        == 200
    )

    assert (
        client.post(
            "/api/v1/auth/presenton/device/start",
            json={"device_name": "Test device"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/auth/presenton/device/poll",
            json={"device_code": "member-device-code-12345"},
        ).status_code
        == 403
    )
    assert client.post("/api/v1/auth/presenton/logout").status_code == 403
    status = client.get("/api/v1/auth/presenton/status").json()
    assert status["can_manage"] is False
    assert status["email"] is None
    assert "scopes" not in status
    asyncio.run(engine.dispose())
