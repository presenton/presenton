from __future__ import annotations

import base64
import hashlib
from collections.abc import Awaitable, Callable, Mapping
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.auth.config import get_or_create_auth_secret
from models.sql.presenton_cloud_provider import PresentonCloudProvider
from utils.datetime_utils import get_current_utc_datetime

GLOBAL_PROVIDER_ID = 1


class PresentonCloudError(RuntimeError):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def _token_cipher() -> Fernet:
    secret = get_or_create_auth_secret().encode("utf-8")
    key = hashlib.sha256(b"presenton-oauth-credentials-v1:" + secret).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def _encrypt_token(token: str) -> str:
    return _token_cipher().encrypt(token.encode("utf-8")).decode("utf-8")


def _decrypt_token(token: str | None) -> str | None:
    if not token:
        return None
    try:
        return _token_cipher().decrypt(token.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError) as exc:
        raise PresentonCloudError(
            401,
            "Stored Presenton credentials cannot be decrypted; reconnect the account",
        ) from exc


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def has_cloud_credentials(provider: PresentonCloudProvider | None) -> bool:
    if (
        not provider
        or not provider.access_token_encrypted
    ):
        return False
    if provider.token_expires_at is None:
        return False
    return _as_utc(provider.token_expires_at) > _as_utc(
        get_current_utc_datetime()
    )


async def get_presenton_provider(
    session: AsyncSession,
    issuer: str,
    *,
    for_update: bool = False,
) -> PresentonCloudProvider | None:
    statement = select(PresentonCloudProvider).where(
        PresentonCloudProvider.id == GLOBAL_PROVIDER_ID,
        PresentonCloudProvider.issuer == issuer,
    )
    if for_update:
        statement = statement.with_for_update()
    return await session.scalar(statement)


async def store_presenton_credentials(
    session: AsyncSession,
    *,
    issuer: str,
    subject: str,
    email: str,
    access_token: str,
    expires_in: int,
) -> PresentonCloudProvider:
    provider = await session.get(
        PresentonCloudProvider,
        GLOBAL_PROVIDER_ID,
        with_for_update=True,
    )
    if provider is None:
        provider = PresentonCloudProvider(
            id=GLOBAL_PROVIDER_ID,
            issuer=issuer,
            subject=subject,
            email=email,
        )
    provider.issuer = issuer
    provider.subject = subject
    provider.email = email
    provider.access_token_encrypted = _encrypt_token(access_token)
    provider.token_expires_at = get_current_utc_datetime() + timedelta(
        seconds=max(1, expires_in)
    )
    session.add(provider)
    await session.commit()
    await session.refresh(provider)
    return provider


def _response_json(response: httpx.Response) -> dict[str, Any]:
    try:
        payload = response.json()
    except ValueError:
        return {}
    return payload if isinstance(payload, dict) else {}


async def get_valid_presenton_access_token(
    session: AsyncSession,
    *,
    issuer: str,
) -> tuple[str, PresentonCloudProvider]:
    provider = await get_presenton_provider(session, issuer)
    if not has_cloud_credentials(provider):
        raise PresentonCloudError(401, "Connect the global Presenton provider first")
    assert provider is not None

    access_token = _decrypt_token(provider.access_token_encrypted)
    if not access_token:
        raise PresentonCloudError(401, "Reconnect your Presenton account")
    return access_token, provider


async def open_presenton_cloud_response(
    session: AsyncSession,
    *,
    issuer: str,
    method: str,
    path: str,
    query_string: str = "",
    headers: Mapping[str, str] | None = None,
    content: bytes | None = None,
) -> tuple[httpx.AsyncClient, httpx.Response]:
    """Open a streaming cloud response with the global provider token."""
    access_token, _provider = await get_valid_presenton_access_token(
        session,
        issuer=issuer,
    )
    url = f"{issuer}{path}"
    if query_string:
        url = f"{url}?{query_string}"

    async def send(token: str) -> tuple[httpx.AsyncClient, httpx.Response]:
        client = httpx.AsyncClient(
            timeout=httpx.Timeout(15 * 60.0),
            follow_redirects=False,
        )
        outbound_headers = dict(headers or {})
        outbound_headers["Authorization"] = f"Bearer {token}"
        try:
            request = client.build_request(
                method,
                url,
                headers=outbound_headers,
                content=content,
            )
            response = await client.send(request, stream=True)
            return client, response
        except httpx.HTTPError as exc:
            await client.aclose()
            raise PresentonCloudError(
                502,
                "Could not connect to the Presenton cloud API",
            ) from exc

    return await send(access_token)


async def revoke_and_clear_presenton_provider(
    session: AsyncSession,
    provider: PresentonCloudProvider,
    provider_request: Callable[..., Awaitable[httpx.Response]] | None = None,
) -> None:
    access_token: str | None
    try:
        access_token = _decrypt_token(provider.access_token_encrypted)
    except PresentonCloudError:
        access_token = None

    if access_token:
        try:
            if provider_request is not None:
                await provider_request(
                    "POST",
                    f"{provider.issuer}/oauth/revoke",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
            else:
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(15.0),
                    follow_redirects=False,
                ) as client:
                    await client.post(
                        f"{provider.issuer}/oauth/revoke",
                        headers={"Authorization": f"Bearer {access_token}"},
                    )
        except httpx.HTTPError:
            pass

    await session.delete(provider)
    await session.commit()
