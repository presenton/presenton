import uuid
import asyncio
import os
import shutil
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.auth.schemas import (
    AdminCreateApiKeyRequest,
    AdminCreateUserRequest,
    AdminResetPasswordRequest,
    PublicUser,
    ApiKeyCreated,
    ApiKeyPublic,
    ApiKeyToken,
)
from api.v1.auth.users import (
    PASSWORD_HELPER,
    get_current_admin,
    read_user_from_cookie,
    serialize_user,
)
from models.sql.user import User
from models.sql.api_key import ApiKey
from services.database import get_async_session
from services.provider_settings import get_provider_settings, save_provider_settings
from services.presenton_cloud import get_presenton_provider, has_cloud_credentials
from services.api_keys import issue_api_key, reveal_api_key
from services.codex_models import CodexModelsResponse
from services.codex_credentials import CONFIG_REVISION_KEY, REVISION_KEY
from services.configured_llm import discover_models
from utils.datetime_utils import get_current_utc_datetime
from utils.get_env import (
    get_app_data_directory_env,
    get_temp_directory_env,
    get_presenton_oauth_issuer,
    is_disable_auth_enabled,
)
from utils.user_config import update_env_with_user_config


API_V1_ADMIN_ROUTER = APIRouter(prefix="/api/v1/admin", tags=["Admin"])


@API_V1_ADMIN_ROUTER.get(
    "/api-keys", response_model=list[ApiKeyPublic]
)
async def list_api_keys(
    _: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_async_session),
):
    return list(
        (
            await session.scalars(
                select(ApiKey).order_by(ApiKey.created_at.desc())
            )
        ).all()
    )


@API_V1_ADMIN_ROUTER.post(
    "/api-keys",
    response_model=ApiKeyCreated,
    status_code=status.HTTP_201_CREATED,
)
async def create_api_key(
    body: AdminCreateApiKeyRequest,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_async_session),
):
    target = await session.get(User, body.user_id)
    if target is None or not target.is_active:
        raise HTTPException(status_code=404, detail="Active user not found")
    api_key, token = await issue_api_key(
        session,
        user_id=target.id,
        created_by_id=admin.id,
        label=body.label,
        expiry_days=body.expiry_days,
    )
    return ApiKeyCreated.model_validate(
        {**ApiKeyPublic.model_validate(api_key).model_dump(), "token": token}
    )


@API_V1_ADMIN_ROUTER.get(
    "/api-keys/{api_key_id}/token",
    response_model=ApiKeyToken,
)
async def get_api_key_token(
    api_key_id: str,
    response: Response,
    _: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_async_session),
):
    api_key = await session.get(ApiKey, api_key_id)
    if api_key is None:
        raise HTTPException(status_code=404, detail="API key not found")
    if api_key.revoked_at is not None:
        raise HTTPException(status_code=410, detail="API key has been revoked")
    token = reveal_api_key(api_key)
    if token is None:
        raise HTTPException(
            status_code=409,
            detail="This API key cannot be revealed",
        )
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return ApiKeyToken(id=api_key.id, token=token)


@API_V1_ADMIN_ROUTER.post(
    "/api-keys/{api_key_id}/revoke",
    response_model=ApiKeyPublic,
)
async def revoke_api_key(
    api_key_id: str,
    _: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_async_session),
):
    api_key = await session.get(ApiKey, api_key_id)
    if api_key is None:
        raise HTTPException(status_code=404, detail="API key not found")
    if api_key.revoked_at is None:
        api_key.revoked_at = get_current_utc_datetime()
        session.add(api_key)
        await session.commit()
        await session.refresh(api_key)
    return api_key


async def require_settings_admin(
    request: Request,
    user: User | None = Depends(read_user_from_cookie),
) -> None:
    del request
    if is_disable_auth_enabled():
        return
    if user is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")


@API_V1_ADMIN_ROUTER.get("/provider-settings")
async def read_provider_settings(
    _: None = Depends(require_settings_admin),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    settings = await get_provider_settings(session)
    provider = await get_presenton_provider(session, get_presenton_oauth_issuer())
    return {
        **{key: value for key, value in settings.items() if key not in {REVISION_KEY, CONFIG_REVISION_KEY}},
        "PRESENTON_CONNECTED": has_cloud_credentials(provider),
        "PRESENTON_EMAIL": provider.email if provider is not None else None,
    }


@API_V1_ADMIN_ROUTER.put("/provider-settings")
async def update_provider_settings(
    config: dict[str, Any] = Body(...),
    _: None = Depends(require_settings_admin),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    saved = await save_provider_settings(session, config)
    update_env_with_user_config()
    return {key: value for key, value in saved.items() if key not in {REVISION_KEY, CONFIG_REVISION_KEY}}


@API_V1_ADMIN_ROUTER.get("/codex/models", response_model=CodexModelsResponse)
async def get_codex_models(
    response: Response,
    _: None = Depends(require_settings_admin),
) -> CodexModelsResponse:
    response.headers["Cache-Control"] = "private, no-store"
    models = await asyncio.to_thread(discover_models)
    return CodexModelsResponse(models=models)


@API_V1_ADMIN_ROUTER.get("/users", response_model=list[PublicUser])
async def list_users(
    _: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_async_session),
):
    users = (
        await session.scalars(
            select(User).order_by(User.created_at.desc(), User.username.asc())
        )
    ).all()
    return [serialize_user(user) for user in users]


@API_V1_ADMIN_ROUTER.post(
    "/users", response_model=PublicUser, status_code=status.HTTP_201_CREATED
)
async def create_user(
    body: AdminCreateUserRequest,
    _: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_async_session),
):
    username = body.username.strip()
    if len(username) < 3:
        raise HTTPException(
            status_code=422,
            detail="Username must be at least 3 characters",
        )
    exists = await session.scalar(
        select(User.id).where(func.lower(User.username) == username.casefold())
    )
    if exists:
        raise HTTPException(status_code=409, detail="Username already exists")
    user = User(
        username=username,
        hashed_password=PASSWORD_HELPER.hash(body.password),
        is_active=True,
        is_verified=True,
        is_superuser=False,
        auth_version=1,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return serialize_user(user)


@API_V1_ADMIN_ROUTER.put("/users/{user_id}/password", response_model=PublicUser)
async def reset_user_password(
    user_id: uuid.UUID,
    body: AdminResetPasswordRequest,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_async_session),
):
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id or user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="The primary administrator password is managed through deployment settings",
        )
    user.hashed_password = PASSWORD_HELPER.hash(body.password)
    user.auth_version += 1
    await session.commit()
    return serialize_user(user)


@API_V1_ADMIN_ROUTER.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: uuid.UUID,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_async_session),
):
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id or user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="The primary administrator account cannot be deleted",
        )
    await session.delete(user)
    await session.commit()
    roots = (
        os.path.join(get_app_data_directory_env(), "images", "users"),
        os.path.join(get_app_data_directory_env(), "exports", "users"),
        os.path.join(get_app_data_directory_env(), "uploads", "users"),
        os.path.join(get_app_data_directory_env(), "pptx-to-html", "users"),
        os.path.join(get_app_data_directory_env(), "pptx-to-json", "users"),
        get_temp_directory_env() or "/tmp/presenton",
    )
    for root in roots:
        owned_dir = os.path.realpath(os.path.join(root, str(user_id)))
        root_dir = os.path.realpath(root)
        if owned_dir.startswith(f"{root_dir}{os.sep}") and os.path.isdir(owned_dir):
            shutil.rmtree(owned_dir)
