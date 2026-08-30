from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import JSONResponse

from api.v1.auth.users import read_user_from_cookie
from models.sql.user import User
from services.database import get_async_session
from services.presenton_cloud import (
    PresentonCloudError,
    get_presenton_provider,
    has_cloud_credentials,
    revoke_and_clear_presenton_provider,
    store_presenton_credentials,
)
from services.provider_settings import get_provider_settings, save_provider_settings
from utils.get_env import (
    get_presenton_oauth_client_id,
    get_presenton_oauth_issuer,
    is_disable_auth_enabled,
)
from utils.user_config import update_env_with_user_config

PRESENTON_OAUTH_ROUTER = APIRouter(
    prefix="/presenton",
    tags=["Presenton Provider"],
)
DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code"
NO_STORE_HEADERS = {"Cache-Control": "no-store", "Pragma": "no-cache"}


class PresentonDeviceStartRequest(BaseModel):
    device_name: str | None = Field(default=None, max_length=120)


class PresentonDevicePollRequest(BaseModel):
    device_code: str = Field(min_length=16, max_length=512)


class PresentonUserInfo(BaseModel):
    sub: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=320)
    name: str | None = Field(default=None, max_length=255)
    picture: str | None = None


def _oauth_config() -> tuple[str, str]:
    return get_presenton_oauth_issuer(), get_presenton_oauth_client_id()


def _can_manage_provider(current_user: User | None) -> bool:
    # Electron is intentionally started with DISABLE_AUTH=true and is treated as
    # an administrator everywhere else in the local auth API. Keep the cloud
    # provider controls consistent with that single-user desktop runtime.
    return is_disable_auth_enabled() or bool(
        current_user and current_user.is_superuser
    )


async def require_presenton_manager(
    current_user: User | None = Depends(read_user_from_cookie),
) -> User | None:
    if is_disable_auth_enabled():
        return None
    if current_user is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def _provider_request(
    method: str,
    url: str,
    **kwargs: Any,
) -> httpx.Response:
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(15.0),
        follow_redirects=False,
    ) as client:
        return await client.request(method, url, **kwargs)


def _provider_json(response: httpx.Response) -> dict[str, Any]:
    try:
        payload = response.json()
    except ValueError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _provider_error(payload: dict[str, Any], fallback: str) -> str:
    description = payload.get("error_description")
    if isinstance(description, str) and description.strip():
        return description
    detail = payload.get("detail")
    if isinstance(detail, str) and detail.strip():
        return detail
    return fallback


async def _best_effort_revoke(issuer: str, access_token: str | None) -> None:
    if not access_token:
        return
    try:
        await _provider_request(
            "POST",
            f"{issuer}/oauth/revoke",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    except httpx.HTTPError:
        pass


@PRESENTON_OAUTH_ROUTER.get("/status")
async def presenton_provider_status(
    session: AsyncSession = Depends(get_async_session),
    current_user: User | None = Depends(read_user_from_cookie),
):
    issuer = get_presenton_oauth_issuer()
    provider = await get_presenton_provider(session, issuer)
    linked = has_cloud_credentials(provider)
    can_manage = _can_manage_provider(current_user)
    return {
        "enabled": True,
        "issuer": issuer,
        "global_provider": True,
        "managed_by_admin": True,
        "can_manage": can_manage,
        "linked": linked,
        "cloud_generation_enabled": linked,
        "email": provider.email if provider is not None and can_manage else None,
    }


@PRESENTON_OAUTH_ROUTER.post("/logout")
async def logout_presenton_account(
    session: AsyncSession = Depends(get_async_session),
    _current_manager: User | None = Depends(require_presenton_manager),
):
    issuer = get_presenton_oauth_issuer()
    provider = await get_presenton_provider(session, issuer)
    if provider is not None:
        await revoke_and_clear_presenton_provider(
            session,
            provider,
            provider_request=_provider_request,
        )
    settings = await get_provider_settings(session)
    if settings.get("LLM") == "presenton":
        # Disconnecting the active cloud account leaves no usable text
        # provider. Keep that state explicit so the UI can require a new
        # provider choice instead of silently selecting an unconfigured one.
        await save_provider_settings(session, {"LLM": None})
        update_env_with_user_config()
    return {"detail": "Disconnected from Presenton successfully"}


@PRESENTON_OAUTH_ROUTER.post("/device/start")
async def start_presenton_provider_connection(
    body: PresentonDeviceStartRequest,
    _current_manager: User | None = Depends(require_presenton_manager),
):
    issuer, client_id = _oauth_config()
    try:
        response = await _provider_request(
            "POST",
            f"{issuer}/oauth/device_authorization",
            data={
                "client_id": client_id,
                "device_name": (body.device_name or "Presenton self-hosted")[:120],
            },
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to the Presenton authorization service",
        ) from exc

    payload = _provider_json(response)
    if not response.is_success:
        raise HTTPException(
            status_code=502 if response.status_code >= 500 else response.status_code,
            detail=_provider_error(payload, "Could not connect Presenton Cloud"),
        )
    required = {
        "device_code",
        "user_code",
        "verification_uri",
        "verification_uri_complete",
        "expires_in",
        "interval",
    }
    if not required.issubset(payload):
        raise HTTPException(
            status_code=502,
            detail="Presenton returned an invalid device authorization response",
        )
    # Always send the browser to the plain approval page. The user enters the
    # displayed code there, keeping it out of URLs, browser history, and logs.
    verification_uri = str(payload["verification_uri"])
    return JSONResponse(
        {
            **payload,
            "verification_uri": verification_uri,
            "verification_uri_complete": verification_uri,
        },
        headers=NO_STORE_HEADERS,
    )


@PRESENTON_OAUTH_ROUTER.post("/device/poll")
async def poll_presenton_provider_connection(
    body: PresentonDevicePollRequest,
    session: AsyncSession = Depends(get_async_session),
    _current_manager: User | None = Depends(require_presenton_manager),
):
    issuer, client_id = _oauth_config()
    try:
        token_response = await _provider_request(
            "POST",
            f"{issuer}/oauth/token",
            data={
                "grant_type": DEVICE_GRANT_TYPE,
                "client_id": client_id,
                "device_code": body.device_code,
            },
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to the Presenton authorization service",
        ) from exc

    token_payload = _provider_json(token_response)
    if not token_response.is_success:
        oauth_error = token_payload.get("error")
        if oauth_error in {"authorization_pending", "slow_down"}:
            return JSONResponse(
                status_code=202,
                content={"status": "pending", "error": oauth_error},
                headers=NO_STORE_HEADERS,
            )
        raise HTTPException(
            status_code=400 if token_response.status_code < 500 else 502,
            detail=_provider_error(token_payload, "Presenton connection failed"),
        )

    access_token = token_payload.get("access_token")
    expires_in = token_payload.get("expires_in")
    if not isinstance(access_token, str) or not access_token:
        raise HTTPException(
            status_code=502, detail="Presenton did not return an access token"
        )

    expires_in_value = expires_in if isinstance(expires_in, int) else 30 * 24 * 60 * 60
    credentials_stored = False
    try:
        try:
            userinfo_response = await _provider_request(
                "GET",
                f"{issuer}/oauth/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=502,
                detail="Could not verify the Presenton account",
            ) from exc
        userinfo_payload = _provider_json(userinfo_response)
        if not userinfo_response.is_success:
            raise HTTPException(
                status_code=502, detail="Could not verify the Presenton account"
            )
        try:
            profile = PresentonUserInfo.model_validate(userinfo_payload)
        except ValueError as exc:
            raise HTTPException(
                status_code=502,
                detail="Presenton returned an invalid user profile",
            ) from exc
        try:
            await store_presenton_credentials(
                session,
                issuer=issuer,
                subject=profile.sub,
                email=profile.email,
                access_token=access_token,
                expires_in=expires_in_value,
            )
        except PresentonCloudError as exc:
            raise HTTPException(
                status_code=exc.status_code,
                detail=exc.detail,
            ) from exc
        credentials_stored = True
        return JSONResponse(
            {
                "status": "authorized",
                "connected": True,
                "email": profile.email,
            },
            headers=NO_STORE_HEADERS,
        )
    finally:
        if not credentials_stored:
            await _best_effort_revoke(issuer, access_token)
