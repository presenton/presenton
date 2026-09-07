import asyncio

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api.v1.auth.config import SESSION_COOKIE_NAME
from api.v1.auth.router import API_V1_AUTH_ROUTER
from models.sql.user import User
from services.database import get_async_session
from tests.mocks.telegram import TEST_BOT_TOKEN, make_allowlist_env, make_init_data


def _build_client(tmp_path) -> tuple[TestClient, object]:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'tg_auth.db'}")
    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    async def create_tables():
        async with engine.begin() as connection:
            await connection.run_sync(User.__table__.create)

    asyncio.run(create_tables())

    async def override_session():
        async with session_maker() as session:
            yield session

    app = FastAPI()
    app.include_router(API_V1_AUTH_ROUTER)
    app.dependency_overrides[get_async_session] = override_session
    return TestClient(app), engine


def _user_count(engine) -> int:
    async def count():
        session_maker = async_sessionmaker(engine, expire_on_commit=False)
        async with session_maker() as session:
            return int(await session.scalar(select(func.count()).select_from(User)) or 0)

    return asyncio.run(count())


def test_first_login_creates_user_and_sets_session_cookie(monkeypatch, tmp_path):
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", TEST_BOT_TOKEN)
    client, engine = _build_client(tmp_path)

    response = client.post(
        "/api/v1/auth/telegram",
        json={"init_data": make_init_data(user_id=111)},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["authenticated"] is True
    assert payload["created"] is True
    assert payload["username"] == "tg_111"
    assert payload["role"] == "user"
    assert SESSION_COOKIE_NAME in response.cookies

    # Кукой проходим до защищённого эндпоинта — сессия рабочая.
    verify = client.get("/api/v1/auth/verify")
    assert verify.status_code == 200
    assert verify.json()["username"] == "tg_111"

    asyncio.run(engine.dispose())


def test_login_with_signature_field(monkeypatch, tmp_path):
    """Новые iOS-клиенты кладут signature в initData, и она участвует
    в data_check_string — логин обязан проходить (живой кейс 2026-09)."""
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", TEST_BOT_TOKEN)
    client, engine = _build_client(tmp_path)

    response = client.post(
        "/api/v1/auth/telegram",
        json={"init_data": make_init_data(user_id=222, with_signature=True)},
    )

    assert response.status_code == 200
    assert response.json()["authenticated"] is True
    asyncio.run(engine.dispose())


def test_cookie_samesite_none_and_secure_behind_https_proxy(monkeypatch, tmp_path):
    """Десктоп-Telegram грузит миниап в кросс-сайтовом iframe: за https-прокси
    кука обязана быть SameSite=None; Secure, иначе сессия туда не долетает."""
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", TEST_BOT_TOKEN)
    client, engine = _build_client(tmp_path)

    response = client.post(
        "/api/v1/auth/telegram",
        json={"init_data": make_init_data(user_id=111)},
        headers={"X-Forwarded-Proto": "https"},
    )

    assert response.status_code == 200
    raw_cookie = response.headers.get("set-cookie", "")
    assert "samesite=none" in raw_cookie.lower()
    assert "secure" in raw_cookie.lower()

    asyncio.run(engine.dispose())


def test_cookie_stays_lax_on_plain_http(monkeypatch, tmp_path):
    """Локальный http-дев: none без secure браузеры отвергают — остаётся lax."""
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", TEST_BOT_TOKEN)
    client, engine = _build_client(tmp_path)

    response = client.post(
        "/api/v1/auth/telegram",
        json={"init_data": make_init_data(user_id=111)},
    )

    assert response.status_code == 200
    raw_cookie = response.headers.get("set-cookie", "")
    assert "samesite=lax" in raw_cookie.lower()

    asyncio.run(engine.dispose())


def test_second_login_reuses_the_same_account(monkeypatch, tmp_path):
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", TEST_BOT_TOKEN)
    client, engine = _build_client(tmp_path)

    first = client.post(
        "/api/v1/auth/telegram",
        json={"init_data": make_init_data(user_id=222)},
    )
    client.cookies.clear()
    second = client.post(
        "/api/v1/auth/telegram",
        json={"init_data": make_init_data(user_id=222)},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["created"] is True
    assert second.json()["created"] is False
    assert first.json()["id"] == second.json()["id"]
    assert _user_count(engine) == 1

    asyncio.run(engine.dispose())


def test_invalid_init_data_gets_401_and_no_cookie(monkeypatch, tmp_path):
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", TEST_BOT_TOKEN)
    client, engine = _build_client(tmp_path)

    response = client.post(
        "/api/v1/auth/telegram",
        json={"init_data": make_init_data().replace("Test", "Hacker")},
    )

    assert response.status_code == 401
    assert SESSION_COOKIE_NAME not in response.cookies
    assert _user_count(engine) == 0

    asyncio.run(engine.dispose())


def test_missing_bot_token_gets_503(monkeypatch, tmp_path):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    client, engine = _build_client(tmp_path)

    response = client.post(
        "/api/v1/auth/telegram",
        json={"init_data": make_init_data()},
    )

    assert response.status_code == 503

    asyncio.run(engine.dispose())


def test_allowlist_unset_keeps_registration_open(monkeypatch, tmp_path):
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", TEST_BOT_TOKEN)
    monkeypatch.delenv("TELEGRAM_ALLOWED_USER_IDS", raising=False)
    client, engine = _build_client(tmp_path)

    response = client.post(
        "/api/v1/auth/telegram",
        json={"init_data": make_init_data(user_id=333)},
    )

    assert response.status_code == 200
    assert _user_count(engine) == 1


def test_allowlist_admits_listed_user_and_blocks_unlisted(monkeypatch, tmp_path):
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", TEST_BOT_TOKEN)
    monkeypatch.setenv("TELEGRAM_ALLOWED_USER_IDS", make_allowlist_env(444, 555))
    client, engine = _build_client(tmp_path)

    listed = client.post(
        "/api/v1/auth/telegram",
        json={"init_data": make_init_data(user_id=444)},
    )
    unlisted = client.post(
        "/api/v1/auth/telegram",
        json={"init_data": make_init_data(user_id=666)},
    )

    assert listed.status_code == 200
    assert unlisted.status_code == 403
    assert _user_count(engine) == 1


def test_allowlist_blocks_existing_account_of_unlisted_user(monkeypatch, tmp_path):
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", TEST_BOT_TOKEN)
    client, engine = _build_client(tmp_path)
    # Аккаунт создан, когда вайтлист ещё не действовал.
    first = client.post(
        "/api/v1/auth/telegram",
        json={"init_data": make_init_data(user_id=777)},
    )
    assert first.status_code == 200

    monkeypatch.setenv("TELEGRAM_ALLOWED_USER_IDS", make_allowlist_env(888))
    client.cookies.clear()
    second = client.post(
        "/api/v1/auth/telegram",
        json={"init_data": make_init_data(user_id=777)},
    )

    assert second.status_code == 403
    assert _user_count(engine) == 1


def test_empty_allowlist_value_keeps_registration_open(monkeypatch, tmp_path):
    # Пустая строка = открыто: compose подставляет её, когда переменная не
    # задана, и деплой без вайтлиста должен работать как раньше.
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", TEST_BOT_TOKEN)
    monkeypatch.setenv("TELEGRAM_ALLOWED_USER_IDS", "")
    client, engine = _build_client(tmp_path)

    response = client.post(
        "/api/v1/auth/telegram",
        json={"init_data": make_init_data(user_id=999)},
    )

    assert response.status_code == 200
    assert _user_count(engine) == 1
