import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api.v1.auth import internal
from api.v1.auth.config import SESSION_COOKIE_NAME
from api.v1.auth.context import reset_current_owner_id, set_current_owner_id
from api.v1.auth.users import (
    PASSWORD_HELPER,
    UserManager,
    UsernameUserDatabase,
    get_jwt_strategy,
)
from models.sql.user import User


def test_internal_headers_use_current_users_database_jwt(monkeypatch, tmp_path):
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    monkeypatch.delenv("DISABLE_AUTH", raising=False)

    async def runner():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'auth.db'}")
        session_maker = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with engine.begin() as connection:
                await connection.run_sync(User.__table__.create)
            async with session_maker() as session:
                user = User(
                    username="admin",
                    hashed_password=PASSWORD_HELPER.hash("secret123"),
                    is_active=True,
                    is_verified=True,
                    is_superuser=True,
                    admin_slot="primary",
                )
                session.add(user)
                await session.commit()
                user_id = user.id

            monkeypatch.setattr(internal, "async_session_maker", session_maker)
            owner_token = set_current_owner_id(user_id)
            try:
                headers = await internal.authenticated_internal_request_headers()
            finally:
                reset_current_owner_id(owner_token)

            cookie = headers["Cookie"]
            token = cookie.removeprefix(f"{SESSION_COOKIE_NAME}=")
            async with session_maker() as session:
                authenticated = await get_jwt_strategy().read_token(
                    token,
                    UserManager(UsernameUserDatabase(session)),
                )
            assert authenticated is not None
            assert authenticated.id == user_id
        finally:
            await engine.dispose()

    asyncio.run(runner())


def test_internal_headers_are_empty_without_request_owner(monkeypatch):
    monkeypatch.delenv("DISABLE_AUTH", raising=False)
    assert asyncio.run(internal.authenticated_internal_request_headers()) == {}
