import uuid
from collections.abc import AsyncGenerator
from typing import Any

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin, exceptions
from fastapi_users.authentication import AuthenticationBackend, CookieTransport
from fastapi_users.authentication.strategy.jwt import JWTStrategy
from fastapi_users.db import BaseUserDatabase
from fastapi_users.jwt import decode_jwt, generate_jwt
from fastapi_users.password import PasswordHelper, PasswordHelperProtocol
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.auth.schemas import InternalUserCreate
from models.sql.user import User
from services.database import get_async_session
from api.v1.auth.config import (
    SESSION_COOKIE_NAME,
    SESSION_TTL_SECONDS,
    get_or_create_auth_secret,
    verify_legacy_password_hash,
)


class LegacyAwarePasswordHelper(PasswordHelperProtocol):
    def __init__(self) -> None:
        self._delegate = PasswordHelper()

    def verify_and_update(
        self, plain_password: str, hashed_password: str
    ) -> tuple[bool, str | None]:
        if hashed_password.startswith("pbkdf2_sha256$"):
            verified = verify_legacy_password_hash(plain_password, hashed_password)
            return verified, self.hash(plain_password) if verified else None
        return self._delegate.verify_and_update(plain_password, hashed_password)

    def hash(self, password: str) -> str:
        return self._delegate.hash(password)

    def generate(self) -> str:
        return self._delegate.generate()


PASSWORD_HELPER = LegacyAwarePasswordHelper()


class UsernameUserDatabase(BaseUserDatabase[User, uuid.UUID]):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, id: uuid.UUID) -> User | None:
        return await self.session.get(User, id)

    async def get_by_email(self, email: str) -> User | None:
        """FastAPI Users names this hook after email; Presenton passes a username."""
        statement = select(User).where(
            func.lower(User.username) == func.lower(email.strip())
        )
        return (await self.session.execute(statement)).unique().scalar_one_or_none()

    async def get_by_oauth_account(
        self, oauth: str, account_id: str
    ) -> User | None:
        del oauth, account_id
        return None

    async def create(self, create_dict: dict[str, Any]) -> User:
        user = User(**create_dict)
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def update(self, user: User, update_dict: dict[str, Any]) -> User:
        for key, value in update_dict.items():
            setattr(user, key, value)
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def delete(self, user: User) -> None:
        await self.session.delete(user)
        await self.session.commit()

    async def add_oauth_account(
        self, user: User, create_dict: dict[str, Any]
    ) -> User:
        del user, create_dict
        raise NotImplementedError("OAuth accounts are not enabled")

    async def update_oauth_account(
        self, user: User, oauth_account: Any, update_dict: dict[str, Any]
    ) -> User:
        del user, oauth_account, update_dict
        raise NotImplementedError("OAuth accounts are not enabled")


async def get_user_db(
    session: AsyncSession = Depends(get_async_session),
) -> AsyncGenerator[UsernameUserDatabase, None]:
    yield UsernameUserDatabase(session)


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    # Presenton intentionally exposes neither self-service password reset nor
    # verification routes. FastAPI Users still requires these class attributes.
    reset_password_token_secret = "presenton-admin-managed-passwords"
    verification_token_secret = reset_password_token_secret

    def __init__(self, user_db: UsernameUserDatabase):
        super().__init__(user_db, PASSWORD_HELPER)

    async def validate_password(
        self, password: str, user: InternalUserCreate | User
    ) -> None:
        del user
        if len(password) < 8:
            raise exceptions.InvalidPasswordException(
                reason="Password must be at least 8 characters"
            )
        if len(password) > 128:
            raise exceptions.InvalidPasswordException(
                reason="Password must be at most 128 characters"
            )


async def get_user_manager(
    user_db: UsernameUserDatabase = Depends(get_user_db),
) -> AsyncGenerator[UserManager, None]:
    yield UserManager(user_db)


class VersionedJWTStrategy(JWTStrategy[User, uuid.UUID]):
    async def read_token(
        self, token: str | None, user_manager: BaseUserManager[User, uuid.UUID]
    ) -> User | None:
        if token is None:
            return None
        try:
            data = decode_jwt(
                token,
                self.decode_key,
                self.token_audience,
                algorithms=[self.algorithm],
            )
            user_id = data.get("sub")
            auth_version = data.get("av")
            if user_id is None or not isinstance(auth_version, int):
                return None
        except jwt.PyJWTError:
            return None
        try:
            user = await user_manager.get(user_manager.parse_id(user_id))
        except (exceptions.UserNotExists, exceptions.InvalidID):
            return None
        if not user.is_active or user.auth_version != auth_version:
            return None
        return user

    async def write_token(self, user: User) -> str:
        return generate_jwt(
            {
                "sub": str(user.id),
                "av": user.auth_version,
                "aud": self.token_audience,
            },
            self.encode_key,
            self.lifetime_seconds,
            algorithm=self.algorithm,
        )


def get_jwt_strategy() -> VersionedJWTStrategy:
    return VersionedJWTStrategy(
        secret=get_or_create_auth_secret(),
        lifetime_seconds=SESSION_TTL_SECONDS,
    )


# The explicit login router uses dynamic Secure-cookie handling, but keeping a
# FastAPI Users backend centralizes the package's account/auth abstractions.
COOKIE_TRANSPORT = CookieTransport(
    cookie_name=SESSION_COOKIE_NAME,
    cookie_max_age=SESSION_TTL_SECONDS,
    cookie_secure=False,
    cookie_httponly=True,
    cookie_samesite="lax",
)
AUTH_BACKEND = AuthenticationBackend(
    name="cookie-jwt",
    transport=COOKIE_TRANSPORT,
    get_strategy=get_jwt_strategy,
)
FASTAPI_USERS = FastAPIUsers[User, uuid.UUID](get_user_manager, [AUTH_BACKEND])


async def read_user_from_cookie(
    request: Request,
    user_manager: UserManager = Depends(get_user_manager),
) -> User | None:
    return await get_jwt_strategy().read_token(
        request.cookies.get(SESSION_COOKIE_NAME), user_manager
    )


async def get_current_user(
    user: User | None = Depends(read_user_from_cookie),
) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user


async def get_current_admin(
    user: User = Depends(get_current_user),
) -> User:
    if not user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def serialize_user(user: User) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "username": user.username,
        "role": "admin" if user.is_superuser else "user",
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }
