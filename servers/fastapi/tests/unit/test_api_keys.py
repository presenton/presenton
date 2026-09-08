import asyncio
from datetime import timedelta
from types import SimpleNamespace
import uuid

from models.sql.api_key import ApiKey
from models.sql.user import User
from services import api_keys
from utils.datetime_utils import get_current_utc_datetime


def test_api_key_format_and_parser_rejects_legacy_formats():
    token = api_keys.build_api_key("0123456789abcdef", "s" * 40)

    assert token.startswith("sk-presenton-")
    assert api_keys.parse_api_key(token) == (
        "0123456789abcdef",
        "s" * 40,
    )
    assert api_keys.parse_api_key("sk-presenton-old") is None
    assert api_keys.parse_api_key("sk-presenton-mcp-0123456789abcdef." + "s" * 40) is None


def test_api_key_can_be_securely_revealed_by_admin(monkeypatch):
    monkeypatch.setattr(
        api_keys,
        "get_or_create_auth_secret",
        lambda: "deployment-auth-secret",
    )
    token = api_keys.build_api_key("0123456789abcdef", "s" * 40)
    api_key = ApiKey(
        id="0123456789abcdef",
        secret_hash="hashed",
        token_encrypted=api_keys.encrypt_api_key(token),
        user_id=uuid.uuid4(),
        created_by_id=uuid.uuid4(),
        expires_at=get_current_utc_datetime() + timedelta(days=1),
    )

    assert token not in api_key.token_encrypted
    assert api_keys.reveal_api_key(api_key) == token


def test_verify_api_key_accepts_active_normal_user(monkeypatch):
    user = User(
        id=uuid.uuid4(),
        username="normal-user",
        hashed_password="unused",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    api_key = ApiKey(
        id="0123456789abcdef",
        secret_hash="hashed",
        user_id=user.id,
        created_by_id=uuid.uuid4(),
        expires_at=get_current_utc_datetime() + timedelta(days=1),
    )

    class Session:
        committed = False

        async def get(self, model, key):
            if model is ApiKey and key == api_key.id:
                return api_key
            if model is User and key == user.id:
                return user
            return None

        def add(self, _value):
            return None

        async def commit(self):
            self.committed = True

    monkeypatch.setattr(
        api_keys,
        "PASSWORD_HELPER",
        SimpleNamespace(verify_and_update=lambda plain, hashed: (plain == "s" * 40, None)),
    )
    session = Session()

    verified = asyncio.run(
        api_keys.verify_api_key(
            session,
            api_keys.build_api_key(api_key.id, "s" * 40),
        )
    )

    assert verified is not None
    assert verified.user is user
    assert verified.api_key_id == api_key.id
    assert session.committed is True
