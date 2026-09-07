import uuid
from dataclasses import dataclass
from typing import Literal

from fastapi import HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.auth.config import SESSION_COOKIE_NAME
from api.v1.auth.users import UserManager, UsernameUserDatabase, get_jwt_strategy
from models.sql.access_token import AccessToken
from models.sql.user import User
from services.api_keys import verify_api_key


@dataclass(frozen=True)
class AuthPrincipal:
    user_id: uuid.UUID
    username: str
    is_admin: bool
    method: Literal["jwt", "api_key"]


async def resolve_request_principal(
    request: Request, session: AsyncSession
) -> tuple[AuthPrincipal | None, User | None]:
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    if cookie_token:
        user_db = UsernameUserDatabase(session)
        user = await get_jwt_strategy().read_token(cookie_token, UserManager(user_db))
        if user:
            return (
                AuthPrincipal(
                    user_id=user.id,
                    username=user.username,
                    is_admin=user.is_superuser,
                    method="jwt",
                ),
                user,
            )

    authorization = request.headers.get("Authorization", "")
    if authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        # Сначала новый механизм API-ключей (Fernet, срок действия), затем
        # легаси-токены из таблицы access_token — существующие токены
        # Telegram-бота продолжают работать после перехода на api_keys.
        verified = await verify_api_key(session, token)
        if verified is not None:
            user = verified.user
            return (
                AuthPrincipal(
                    user_id=user.id,
                    username=user.username,
                    is_admin=user.is_superuser,
                    method="api_key",
                ),
                user,
            )
        if token.startswith("sk-presenton-"):
            access_token = await session.get(AccessToken, token)
            if access_token is not None:
                user = await session.get(User, access_token.user_id)
                if user is not None and user.is_active and user.is_superuser:
                    return (
                        AuthPrincipal(
                            user_id=user.id,
                            username=user.username,
                            is_admin=True,
                            method="api_key",
                        ),
                        user,
                    )

    return None, None


def principal_from_request(request: Request) -> AuthPrincipal:
    principal = getattr(request.state, "auth_principal", None)
    if principal is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return principal


def require_browser_admin_principal(request: Request) -> AuthPrincipal:
    principal = principal_from_request(request)
    if principal.method != "jwt" or not principal.is_admin:
        raise HTTPException(status_code=403, detail="Admin browser session required")
    return principal
