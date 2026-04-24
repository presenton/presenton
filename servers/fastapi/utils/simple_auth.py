import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Optional

from fastapi import Request
from starlette.responses import Response

from utils.get_env import get_user_config_path_env

SESSION_COOKIE_NAME = "presenton_session"
PBKDF2_ITERATIONS = 200_000
SESSION_TTL_SECONDS = 60 * 60 * 24 * 30


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _base64url_decode(value: str) -> bytes:
    padded = value + "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(padded.encode("utf-8"))


def _load_user_config() -> dict:
    user_config_path = get_user_config_path_env()
    if not user_config_path or not os.path.exists(user_config_path):
        return {}

    try:
        with open(user_config_path, "r", encoding="utf-8") as config_file:
            data = json.load(config_file)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_user_config(config: dict) -> None:
    user_config_path = get_user_config_path_env()
    if not user_config_path:
        raise ValueError("USER_CONFIG_PATH is not set")

    os.makedirs(os.path.dirname(user_config_path), exist_ok=True)
    with open(user_config_path, "w", encoding="utf-8") as config_file:
        json.dump(config, config_file)


def _hash_password(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )


def _encode_password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = _hash_password(password, salt)
    salt_encoded = _base64url_encode(salt)
    digest_encoded = _base64url_encode(digest)
    return (
        f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt_encoded}${digest_encoded}"
    )


def _verify_password_hash(password: str, encoded_hash: str) -> bool:
    try:
        algorithm, iterations_str, salt_encoded, digest_encoded = encoded_hash.split("$")
        if algorithm != "pbkdf2_sha256":
            return False

        iterations = int(iterations_str)
        salt = _base64url_decode(salt_encoded)
        expected_digest = _base64url_decode(digest_encoded)
        actual_digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, iterations
        )
        return hmac.compare_digest(actual_digest, expected_digest)
    except Exception:
        return False


def _get_or_create_auth_secret(config: dict) -> str:
    secret = config.get("AUTH_SECRET_KEY")
    if secret:
        return secret

    secret = _base64url_encode(secrets.token_bytes(32))
    config["AUTH_SECRET_KEY"] = secret
    _save_user_config(config)
    return secret


def is_auth_configured() -> bool:
    config = _load_user_config()
    return bool(config.get("AUTH_USERNAME") and config.get("AUTH_PASSWORD_HASH"))


def get_configured_auth_username() -> Optional[str]:
    config = _load_user_config()
    username = config.get("AUTH_USERNAME")
    if isinstance(username, str) and username.strip():
        return username.strip()
    return None


def setup_initial_credentials(username: str, password: str) -> None:
    cleaned_username = (username or "").strip()
    if len(cleaned_username) < 3:
        raise ValueError("Username must be at least 3 characters")

    if len(password or "") < 6:
        raise ValueError("Password must be at least 6 characters")

    config = _load_user_config()
    if config.get("AUTH_USERNAME") and config.get("AUTH_PASSWORD_HASH"):
        raise ValueError("Credentials already configured")

    config["AUTH_USERNAME"] = cleaned_username
    config["AUTH_PASSWORD_HASH"] = _encode_password_hash(password)
    _get_or_create_auth_secret(config)
    _save_user_config(config)


def force_set_credentials(username: str, password: str) -> None:
    """Overwrite stored credentials; used by env-based preseed/override."""
    cleaned_username = (username or "").strip()
    if len(cleaned_username) < 3:
        raise ValueError("Username must be at least 3 characters")

    if len(password or "") < 6:
        raise ValueError("Password must be at least 6 characters")

    config = _load_user_config()
    config["AUTH_USERNAME"] = cleaned_username
    config["AUTH_PASSWORD_HASH"] = _encode_password_hash(password)
    # Rotate the signing secret so any previously-issued tokens stop validating.
    config["AUTH_SECRET_KEY"] = _base64url_encode(secrets.token_bytes(32))
    _save_user_config(config)


def clear_stored_credentials() -> None:
    """Remove stored credentials; next boot will request setup again."""
    config = _load_user_config()
    removed = False
    for key in ("AUTH_USERNAME", "AUTH_PASSWORD_HASH", "AUTH_SECRET_KEY"):
        if key in config:
            config.pop(key, None)
            removed = True
    if removed:
        _save_user_config(config)


def verify_credentials(username: str, password: str) -> bool:
    config = _load_user_config()
    stored_username = config.get("AUTH_USERNAME")
    stored_hash = config.get("AUTH_PASSWORD_HASH")

    if not stored_username or not stored_hash:
        return False

    cleaned_username = (username or "").strip()
    if not hmac.compare_digest(cleaned_username, stored_username):
        return False

    return _verify_password_hash(password or "", stored_hash)


def _sign_payload(payload_encoded: str, secret: str) -> str:
    signature = hmac.new(
        secret.encode("utf-8"), payload_encoded.encode("utf-8"), hashlib.sha256
    ).digest()
    return _base64url_encode(signature)


def create_session_token(username: str) -> str:
    config = _load_user_config()
    secret = _get_or_create_auth_secret(config)

    issued_at = int(time.time())
    payload = {
        "v": 1,
        "u": username,
        "iat": issued_at,
        "exp": issued_at + SESSION_TTL_SECONDS,
    }

    payload_encoded = _base64url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    signature_encoded = _sign_payload(payload_encoded, secret)
    return f"{payload_encoded}.{signature_encoded}"


def validate_session_token(token: Optional[str]) -> Optional[str]:
    if not token:
        return None

    config = _load_user_config()
    stored_username = config.get("AUTH_USERNAME")
    if not stored_username:
        return None

    secret = config.get("AUTH_SECRET_KEY")
    if not secret:
        return None

    try:
        payload_encoded, signature_encoded = token.split(".", 1)
    except ValueError:
        return None

    expected_signature = _sign_payload(payload_encoded, secret)
    if not hmac.compare_digest(signature_encoded, expected_signature):
        return None

    try:
        payload_raw = _base64url_decode(payload_encoded)
        payload = json.loads(payload_raw)
    except Exception:
        return None

    username = payload.get("u")
    version = payload.get("v")
    expires_at = payload.get("exp")
    if not isinstance(username, str) or not isinstance(expires_at, int):
        return None

    if version != 1:
        return None

    if not hmac.compare_digest(username, stored_username):
        return None

    if expires_at < int(time.time()):
        return None

    return username


def get_session_token_from_request(request: Request) -> Optional[str]:
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    if cookie_token:
        return cookie_token

    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip() or None

    return None


def get_basic_auth_credentials_from_request(
    request: Request,
) -> Optional[tuple[str, str]]:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.lower().startswith("basic "):
        return None

    encoded_value = auth_header[6:].strip()
    if not encoded_value:
        return None

    try:
        decoded_value = base64.b64decode(encoded_value).decode("utf-8")
    except Exception:
        return None

    if ":" not in decoded_value:
        return None

    username, password = decoded_value.split(":", 1)
    return username, password


def get_auth_status(session_token: Optional[str] = None) -> dict:
    config = _load_user_config()
    configured = bool(config.get("AUTH_USERNAME") and config.get("AUTH_PASSWORD_HASH"))

    if not configured:
        return {
            "configured": False,
            "authenticated": False,
            "username": None,
        }

    username = validate_session_token(session_token)
    return {
        "configured": True,
        "authenticated": bool(username),
        "username": username,
    }


def _is_secure_request(request: Request) -> bool:
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    if forwarded_proto.lower() == "https":
        return True
    return request.url.scheme == "https"


def set_session_cookie(response: Response, token: str, request: Request) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=_is_secure_request(request),
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response, request: Request) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=_is_secure_request(request),
        samesite="lax",
        path="/",
    )
