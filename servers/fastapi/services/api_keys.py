from dataclasses import dataclass
import base64
from datetime import datetime, timedelta, timezone
import hashlib
import re
import secrets
import uuid

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.auth.config import get_or_create_auth_secret
from api.v1.auth.users import PASSWORD_HELPER
from models.sql.api_key import ApiKey
from models.sql.user import User
from utils.datetime_utils import get_current_utc_datetime


API_KEY_PREFIX = "sk-presenton-"
DEFAULT_EXPIRY_DAYS = 90
MAX_EXPIRY_DAYS = 365
API_KEY_ID_PATTERN = re.compile(r"^[0-9a-f]{16}$")


@dataclass(frozen=True)
class VerifiedApiKey:
    api_key_id: str
    user: User


def _utc_aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def build_api_key(api_key_id: str, secret: str) -> str:
    return f"{API_KEY_PREFIX}{api_key_id}.{secret}"


def _api_key_cipher() -> Fernet:
    encryption_key = hashlib.sha256(
        get_or_create_auth_secret().encode("utf-8")
    ).digest()
    return Fernet(base64.urlsafe_b64encode(encryption_key))


def encrypt_api_key(token: str) -> str:
    return _api_key_cipher().encrypt(token.encode("utf-8")).decode("ascii")


def parse_api_key(token: str) -> tuple[str, str] | None:
    if not token.startswith(API_KEY_PREFIX):
        return None
    body = token[len(API_KEY_PREFIX) :]
    api_key_id, separator, secret = body.partition(".")
    if (
        not separator
        or not API_KEY_ID_PATTERN.fullmatch(api_key_id)
        or len(secret) < 32
    ):
        return None
    return api_key_id, secret


def reveal_api_key(api_key: ApiKey) -> str | None:
    if not api_key.token_encrypted:
        return None
    try:
        token = _api_key_cipher().decrypt(
            api_key.token_encrypted.encode("ascii")
        ).decode("utf-8")
    except (InvalidToken, UnicodeError, ValueError):
        return None
    parsed = parse_api_key(token)
    if parsed is None or parsed[0] != api_key.id:
        return None
    return token


async def issue_api_key(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    created_by_id: uuid.UUID,
    label: str,
    expiry_days: int = DEFAULT_EXPIRY_DAYS,
) -> tuple[ApiKey, str]:
    if expiry_days < 1 or expiry_days > MAX_EXPIRY_DAYS:
        raise ValueError(f"expiry_days must be between 1 and {MAX_EXPIRY_DAYS}")
    secret = secrets.token_urlsafe(40)
    api_key_id = secrets.token_hex(8)
    token = build_api_key(api_key_id, secret)
    api_key = ApiKey(
        id=api_key_id,
        user_id=user_id,
        created_by_id=created_by_id,
        label=label.strip() or "API client",
        secret_hash=PASSWORD_HELPER.hash(secret),
        token_encrypted=encrypt_api_key(token),
        expires_at=get_current_utc_datetime() + timedelta(days=expiry_days),
    )
    session.add(api_key)
    await session.commit()
    await session.refresh(api_key)
    return api_key, token


async def verify_api_key(
    session: AsyncSession, token: str
) -> VerifiedApiKey | None:
    parsed = parse_api_key(token)
    if parsed is None:
        return None
    api_key_id, secret = parsed
    api_key = await session.get(ApiKey, api_key_id)
    if api_key is None or api_key.revoked_at is not None:
        return None
    now = get_current_utc_datetime()
    if _utc_aware(api_key.expires_at) <= _utc_aware(now):
        return None
    verified, replacement_hash = PASSWORD_HELPER.verify_and_update(
        secret, api_key.secret_hash
    )
    if not verified:
        return None
    user = await session.get(User, api_key.user_id)
    if user is None or not user.is_active:
        return None
    api_key.last_used_at = now
    if replacement_hash:
        api_key.secret_hash = replacement_hash
    session.add(api_key)
    await session.commit()
    return VerifiedApiKey(api_key_id=api_key.id, user=user)
