"""Интеграционные тесты квот на генерацию (P4).

Проверяем: блокировку 429 на лимите, безлимит при GENERATION_QUOTA_PER_DAY=0,
пропуск суперпользователя и DISABLE_AUTH, персональный override
(user.generation_limit), скользящее окно 24ч и GET /api/v1/quota.
"""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from api.v1.auth.context import reset_current_owner_id, set_current_owner_id
from api.v1.auth.users import read_user_from_cookie
from api.v1.quota import QUOTA_ROUTER
from models.sql.generation_usage import GenerationUsageModel
from models.sql.user import User
from services.database import get_async_session
from services.quota_service import enforce_generation_quota

OWNER = uuid.uuid4()
OWNER_STR = str(OWNER)


def _make_user(user_id: uuid.UUID, *, superuser: bool = False, limit: int | None = None) -> User:
    return User(
        id=user_id,
        username=f"u-{user_id.hex[:8]}",
        hashed_password="x",
        is_active=True,
        is_verified=True,
        is_superuser=superuser,
        auth_version=1,
        generation_limit=limit,
    )


def _usage(owner_id: uuid.UUID, age: timedelta = timedelta()) -> GenerationUsageModel:
    return GenerationUsageModel(
        id=uuid.uuid4(),
        owner_id=owner_id,
        created_at=datetime.now(UTC) - age,
    )


def _build_app(tmp_path, monkeypatch, quota_env: str | None = "2"):
    db_path = tmp_path / f"quota-{uuid.uuid4().hex}.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    asyncio.run(_create(engine))
    maker = async_sessionmaker(engine, expire_on_commit=False)

    if quota_env is not None:
        monkeypatch.setenv("GENERATION_QUOTA_PER_DAY", quota_env)
    else:
        monkeypatch.delenv("GENERATION_QUOTA_PER_DAY", raising=False)

    app = FastAPI()

    @app.middleware("http")
    async def owner_context(request, call_next):
        token = set_current_owner_id(OWNER)
        try:
            return await call_next(request)
        finally:
            reset_current_owner_id(token)

    app.include_router(QUOTA_ROUTER)

    async def _override():
        async with maker() as session:
            yield session

    async def _override_user():
        async with maker() as session:
            return await session.get(User, OWNER)

    app.dependency_overrides[get_async_session] = _override
    app.dependency_overrides[read_user_from_cookie] = _override_user
    return app, maker


async def _create(engine):
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


def _seed(maker, *rows):
    async def _insert():
        async with maker() as session:
            async with session.begin():
                session.add_all(rows)

    asyncio.run(_insert())


def _enforce(maker, owner_id: uuid.UUID):
    async def _run():
        set_current_owner_id(owner_id)
        async with maker() as session:
            await enforce_generation_quota(session)

    asyncio.run(_run())


def test_quota_blocks_when_limit_reached(tmp_path, monkeypatch):
    """Два запуска при лимите 2 проходят, третий — 429."""
    app, maker = _build_app(tmp_path, monkeypatch, quota_env="2")
    del app
    _seed(maker, _make_user(OWNER))

    _enforce(maker, OWNER)
    _enforce(maker, OWNER)
    with pytest.raises(HTTPException) as exc:
        _enforce(maker, OWNER)
    assert exc.value.status_code == 429
    assert "Retry-After" in exc.value.headers


def test_quota_zero_env_means_unlimited(tmp_path, monkeypatch):
    """GENERATION_QUOTA_PER_DAY=0 — без лимита."""
    app, maker = _build_app(tmp_path, monkeypatch, quota_env="0")
    del app
    _seed(maker, _make_user(OWNER))
    for _ in range(5):
        _enforce(maker, OWNER)


def test_quota_skips_superuser(tmp_path, monkeypatch):
    app, maker = _build_app(tmp_path, monkeypatch, quota_env="1")
    del app
    _seed(maker, _make_user(OWNER, superuser=True))
    _enforce(maker, OWNER)
    _enforce(maker, OWNER)  # второй запуск тоже проходит — лимит не применяется


def test_quota_skips_without_owner(tmp_path, monkeypatch):
    """DISABLE_AUTH: owner отсутствует — проверка отключена."""
    app, maker = _build_app(tmp_path, monkeypatch, quota_env="1")
    del app

    async def _run():
        set_current_owner_id(None)
        async with maker() as session:
            await enforce_generation_quota(session)
            await enforce_generation_quota(session)

    asyncio.run(_run())


def test_user_quota_override_beats_env(tmp_path, monkeypatch):
    """user.generation_limit важнее дефолта из env."""
    app, maker = _build_app(tmp_path, monkeypatch, quota_env="1")
    del app
    _seed(maker, _make_user(OWNER, limit=3))
    for _ in range(3):
        _enforce(maker, OWNER)
    with pytest.raises(HTTPException):
        _enforce(maker, OWNER)


def test_old_usage_outside_24h_window_is_ignored(tmp_path, monkeypatch):
    """Скользящее окно: запуски старше 24ч не считаются."""
    app, maker = _build_app(tmp_path, monkeypatch, quota_env="1")
    del app
    _seed(maker, _make_user(OWNER), _usage(OWNER, age=timedelta(hours=25)))
    _enforce(maker, OWNER)  # не должно быть 429


def test_other_users_usage_does_not_count(tmp_path, monkeypatch):
    app, maker = _build_app(tmp_path, monkeypatch, quota_env="1")
    del app
    _seed(maker, _make_user(OWNER), _usage(uuid.uuid4()))
    _enforce(maker, OWNER)  # чужой расход не жжёт нашу квоту


def test_quota_status_endpoint(tmp_path, monkeypatch):
    """GET /api/v1/quota отдаёт лимит/расход/остаток текущего пользователя."""
    app, maker = _build_app(tmp_path, monkeypatch, quota_env="10")
    _seed(maker, _make_user(OWNER))
    _enforce(maker, OWNER)

    async def _call():
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            return await client.get("/api/v1/quota")

    response = asyncio.run(_call())

    assert response.status_code == 200
    body = response.json()
    assert body["limit"] == 10
    assert body["used"] == 1
    assert body["remaining"] == 9
    assert body["resets_in_seconds"] is None


def test_quota_status_endpoint_requires_session(tmp_path, monkeypatch):
    """Без сессии — 401: контракт для бота (перелогин через auth/telegram)."""
    app, _maker = _build_app(tmp_path, monkeypatch, quota_env="10")

    async def _call():
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            return await client.get("/api/v1/quota")

    response = asyncio.run(_call())

    assert response.status_code == 401
