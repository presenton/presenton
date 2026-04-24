import os
from utils.get_env import get_app_data_directory_env, get_database_url_env
from urllib.parse import urlsplit, urlunsplit, parse_qsl
import ssl


def _ensure_sqlite_parent_dir(database_url: str) -> None:
    if not database_url.startswith("sqlite://"):
        return

    split_result = urlsplit(database_url)
    db_path = split_result.path
    if not db_path:
        return

    # sqlite URLs on Windows can start with /C:/..., normalize that for os.path.
    if os.name == "nt" and len(db_path) >= 3 and db_path[0] == "/" and db_path[2] == ":":
        db_path = db_path[1:]

    parent = os.path.dirname(db_path)
    if parent:
        os.makedirs(parent, exist_ok=True)
def _int_env(name: str, default: int) -> int:
    """Read an integer from an environment variable, falling back to *default*."""
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def get_pool_kwargs() -> dict:
    """Build SQLAlchemy engine pool keyword arguments from environment variables.

    Supported variables (all optional):
        DB_POOL_SIZE          – max persistent connections (default 5)
        DB_MAX_OVERFLOW       – extra connections above pool_size (default 10)
        DB_POOL_TIMEOUT       – seconds to wait for a connection (default 30)
        DB_POOL_RECYCLE       – seconds before a connection is recycled (default 1800)
        DB_POOL_PRE_PING      – enable connection liveness check (default true)

    For SQLite the pool settings are not applicable and an empty dict is
    returned, since SQLite uses ``StaticPool`` / ``NullPool`` by default.
    """
    return {
        "pool_size": _int_env("DB_POOL_SIZE", 5),
        "max_overflow": _int_env("DB_MAX_OVERFLOW", 10),
        "pool_timeout": _int_env("DB_POOL_TIMEOUT", 30),
        "pool_recycle": _int_env("DB_POOL_RECYCLE", 1800),
        "pool_pre_ping": os.getenv("DB_POOL_PRE_PING", "true").lower()
        not in ("false", "0", "no"),
    }


def get_database_url_and_connect_args() -> tuple[str, dict]:
    database_url = get_database_url_env() or "sqlite:///" + os.path.join(
        get_app_data_directory_env() or "/tmp/presenton", "fastapi.db"
    )

    _ensure_sqlite_parent_dir(database_url)

    if database_url.startswith("sqlite://"):
        database_url = database_url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    elif database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif database_url.startswith("mysql://"):
        database_url = database_url.replace("mysql://", "mysql+aiomysql://", 1)
    else:
        database_url = database_url

    connect_args = {}
    if "sqlite" in database_url:
        connect_args["check_same_thread"] = False

    try:
        split_result = urlsplit(database_url)
        if split_result.query:
            query_params = parse_qsl(split_result.query, keep_blank_values=True)
            driver_scheme = split_result.scheme
            for k, v in query_params:
                key_lower = k.lower()
                if key_lower == "sslmode" and "postgresql+asyncpg" in driver_scheme:
                    if v.lower() != "disable" and "sqlite" not in database_url:
                        connect_args["ssl"] = ssl.create_default_context()

            database_url = urlunsplit(
                (
                    split_result.scheme,
                    split_result.netloc,
                    split_result.path,
                    "",
                    split_result.fragment,
                )
            )
    except Exception:
        pass

    return database_url, connect_args
