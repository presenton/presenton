import base64
import hashlib
import hmac
import secrets

from utils.get_env import get_user_config_path_env
from utils.user_config_store import read_user_config_file, update_user_config_file

SESSION_COOKIE_NAME = "presenton_session"
SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
AUTH_CONFIG_FIELDS = ("AUTH_USERNAME", "AUTH_PASSWORD_HASH", "AUTH_SECRET_KEY")


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _base64url_decode(value: str) -> bytes:
    padded = value + "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(padded.encode("utf-8"))


def _load_user_config() -> dict:
    user_config_path = get_user_config_path_env()
    if not user_config_path:
        return {}
    return read_user_config_file(user_config_path)


def _save_auth_config(config: dict) -> None:
    user_config_path = get_user_config_path_env()
    if not user_config_path:
        raise ValueError("USER_CONFIG_PATH is not set")

    auth_config = {key: config[key] for key in AUTH_CONFIG_FIELDS if key in config}

    def merge_auth_config(existing: dict) -> dict:
        existing.update(auth_config)
        return existing

    update_user_config_file(user_config_path, merge_auth_config)


def verify_legacy_password_hash(password: str, encoded_hash: str) -> bool:
    """Verify hashes produced by the pre-database single-user auth system."""
    try:
        algorithm, iterations_str, salt_encoded, digest_encoded = encoded_hash.split("$")
        if algorithm != "pbkdf2_sha256":
            return False

        iterations = int(iterations_str)
        salt = _base64url_decode(salt_encoded)
        expected_digest = _base64url_decode(digest_encoded)
        actual_digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            iterations,
        )
        return hmac.compare_digest(actual_digest, expected_digest)
    except Exception:
        return False


def get_or_create_auth_secret() -> str:
    """Return the deployment signing secret used by database-backed JWT auth."""
    config = _load_user_config()
    secret = config.get("AUTH_SECRET_KEY")
    if isinstance(secret, str) and secret:
        return secret

    secret = _base64url_encode(secrets.token_bytes(32))
    config["AUTH_SECRET_KEY"] = secret
    _save_auth_config(config)
    return secret


def get_legacy_admin_credentials() -> tuple[str | None, str | None]:
    """Return the pre-multi-user username and encoded password hash, if present."""
    config = _load_user_config()
    username = config.get("AUTH_USERNAME")
    password_hash = config.get("AUTH_PASSWORD_HASH")
    return (
        username.strip() if isinstance(username, str) and username.strip() else None,
        password_hash if isinstance(password_hash, str) and password_hash else None,
    )


def persist_admin_credentials(
    username: str,
    password_hash: str,
    *,
    rotate_secret: bool = False,
) -> None:
    """Keep the rollback/recovery credential copy in userConfig.json current."""
    config = _load_user_config()
    config["AUTH_USERNAME"] = username.strip()
    config["AUTH_PASSWORD_HASH"] = password_hash
    if rotate_secret or not config.get("AUTH_SECRET_KEY"):
        config["AUTH_SECRET_KEY"] = _base64url_encode(secrets.token_bytes(32))
    _save_auth_config(config)
