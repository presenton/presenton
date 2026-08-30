import ipaddress

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import JSONResponse

from api.v1.auth.schemas import AuthCredentialsRequest, LoginCredentialsRequest
from api.v1.auth.assets import is_app_data_path_authorized
from api.v1.auth.rate_limit import LOGIN_RATE_LIMITER, login_rate_limit_key
from api.v1.auth.principal import resolve_request_principal
from api.v1.auth.users import (
    PASSWORD_HELPER,
    get_jwt_strategy,
    read_user_from_cookie,
    serialize_user,
)
from models.sql.user import User
from services.database import get_async_session
from utils.get_env import is_disable_auth_enabled
from api.v1.auth.config import (
    SESSION_COOKIE_NAME,
    SESSION_TTL_SECONDS,
    persist_admin_credentials,
)
from api.v1.auth.token import TOKEN_ROUTER
from api.v1.auth.presenton_oauth import PRESENTON_OAUTH_ROUTER


API_V1_AUTH_ROUTER = APIRouter(prefix="/api/v1/auth", tags=["Auth"])
API_V1_AUTH_ROUTER.include_router(TOKEN_ROUTER)
API_V1_AUTH_ROUTER.include_router(PRESENTON_OAUTH_ROUTER)


def normalize_username(username: str) -> str:
    return username.strip()


async def _account_count(session: AsyncSession) -> int:
    return int(await session.scalar(select(func.count()).select_from(User)) or 0)


def _secure_request(request: Request) -> bool:
    return (
        request.headers.get("x-forwarded-proto", "").lower() == "https"
        or request.url.scheme == "https"
    )


def _login_client_host(request: Request) -> str | None:
    peer_host = request.client.host if request.client else None
    try:
        peer_is_loopback = bool(
            peer_host and ipaddress.ip_address(peer_host).is_loopback
        )
    except ValueError:
        peer_is_loopback = False
    if peer_is_loopback:
        forwarded_host = request.headers.get("x-real-ip", "").strip()
        try:
            if forwarded_host:
                return str(ipaddress.ip_address(forwarded_host))
        except ValueError:
            pass
    return peer_host


def _set_login_cookie(response: JSONResponse, token: str, request: Request) -> None:
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=_secure_request(request),
        samesite="lax",
        path="/",
    )


@API_V1_AUTH_ROUTER.get("/status")
async def get_status(
    session: AsyncSession = Depends(get_async_session),
    user: User | None = Depends(read_user_from_cookie),
):
    if is_disable_auth_enabled():
        return {
            "configured": True,
            "authenticated": True,
            "username": "electron",
            "user_id": None,
            "role": "admin",
        }
    configured = await _account_count(session) > 0
    return {
        "configured": configured,
        "authenticated": user is not None,
        "username": user.username if user else None,
        "user_id": str(user.id) if user else None,
        "role": "admin" if user and user.is_superuser else ("user" if user else None),
    }


@API_V1_AUTH_ROUTER.get("/verify")
async def verify_session(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    if is_disable_auth_enabled():
        return {
            "authenticated": True,
            "username": "electron",
            "role": "admin",
            "method": "local",
        }
    principal, user = await resolve_request_principal(request, session)
    if principal is None or user is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    original_uri = request.headers.get("x-original-uri")
    if original_uri and not is_app_data_path_authorized(
        original_uri,
        user_id=principal.user_id,
        is_admin=principal.is_admin,
    ):
        raise HTTPException(status_code=403, detail="Asset access denied")
    return {
        "authenticated": True,
        **serialize_user(user),
        "method": principal.method,
    }


@API_V1_AUTH_ROUTER.post("/setup")
async def setup_credentials(
    body: AuthCredentialsRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    if await _account_count(session):
        raise HTTPException(status_code=409, detail="Credentials already configured")

    username = normalize_username(body.username)
    if len(username) < 3:
        raise HTTPException(
            status_code=422,
            detail="Username must be at least 3 characters",
        )
    password_hash = PASSWORD_HELPER.hash(body.password)
    user = User(
        username=username,
        hashed_password=password_hash,
        is_active=True,
        is_verified=True,
        is_superuser=True,
        admin_slot="primary",
        auth_version=1,
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail="Credentials already configured",
        )
    await session.commit()
    await session.refresh(user)
    persist_admin_credentials(username, password_hash)
    return {
        "configured": True,
        "authenticated": False,
        "username": user.username,
        "role": "admin",
    }


@API_V1_AUTH_ROUTER.post("/login")
async def login(
    body: LoginCredentialsRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    if not await _account_count(session):
        raise HTTPException(status_code=428, detail="Login setup is required")
    username = normalize_username(body.username)
    rate_limit_key = login_rate_limit_key(
        _login_client_host(request),
        username,
    )
    retry_after = await LOGIN_RATE_LIMITER.retry_after(rate_limit_key)
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )
    user = await session.scalar(
        select(User).where(func.lower(User.username) == username.casefold())
    )
    if user is None or not user.is_active:
        PASSWORD_HELPER.hash(body.password)
        await LOGIN_RATE_LIMITER.record_failure(rate_limit_key)
        raise HTTPException(status_code=401, detail="Unauthorized")

    verified, replacement_hash = PASSWORD_HELPER.verify_and_update(
        body.password, user.hashed_password
    )
    if not verified:
        await LOGIN_RATE_LIMITER.record_failure(rate_limit_key)
        raise HTTPException(status_code=401, detail="Unauthorized")
    if replacement_hash:
        user.hashed_password = replacement_hash
        await session.commit()
    await LOGIN_RATE_LIMITER.clear(rate_limit_key)

    token = await get_jwt_strategy().write_token(user)
    response = JSONResponse(
        {
            "configured": True,
            "authenticated": True,
            **serialize_user(user),
        }
    )
    _set_login_cookie(response, token, request)
    return response


@API_V1_AUTH_ROUTER.post("/logout")
async def logout(request: Request):
    response = JSONResponse({"success": True})
    response.delete_cookie(
        SESSION_COOKIE_NAME,
        httponly=True,
        secure=_secure_request(request),
        samesite="lax",
        path="/",
    )
    return response
