"""Serialized credential transitions with revision-checked refresh commits.

HTTP is performed outside the lock. A late refresh can never resurrect a logged
out account or replace credentials from a newer login, including another process.
"""
import os
import threading
import time
from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Any, Mapping

from fastapi import HTTPException
from sqlalchemy import create_engine, func, select

from models.sql.provider_settings import ProviderSettings
from utils.datetime_utils import get_current_utc_datetime
from utils.db_utils import get_database_url_and_connect_args, to_sync_sqlalchemy_url
from utils.get_env import get_database_url_env, get_user_config_path_env
from utils.oauth.openai_codex import TokenSuccess, get_account_profile, refresh_access_token
from utils.user_config_store import update_user_config_file
from services.codex_models import auth_required


REVISION_KEY = "_codex_credentials_revision"
CONFIG_REVISION_KEY = "_provider_settings_revision"
CREDENTIAL_FIELDS = frozenset({
    "CODEX_ACCESS_TOKEN", "CODEX_REFRESH_TOKEN", "CODEX_TOKEN_EXPIRES",
    "CODEX_ACCOUNT_ID", "CODEX_USERNAME", "CODEX_EMAIL", "CODEX_IS_PRO",
})
_condition = threading.Condition(threading.RLock())
_refreshing: set[tuple[int, str]] = set()


@dataclass(frozen=True)
class CredentialSnapshot:
    revision: int
    access_token: str = field(repr=False)
    refresh_token: str = field(repr=False)
    account_id: str | None = field(repr=False)
    expires: int | None
    config: Mapping[str, Any] = field(repr=False)

    @property
    def identity(self) -> tuple[int, str]:
        return self.revision, self.refresh_token


def _engine():
    # The async helper strips query options. Psycopg must receive the original
    # DSN so settings such as sslmode/sslrootcert retain their native meaning.
    url = get_database_url_env()
    if not url:
        url, _ = get_database_url_and_connect_args()
    return create_engine(to_sync_sqlalchemy_url(url), hide_parameters=True)


def read_provider_snapshot() -> dict[str, Any]:
    engine = _engine()
    try:
        with engine.connect() as connection:
            config = connection.execute(select(ProviderSettings.__table__.c.config).where(
                ProviderSettings.__table__.c.id == 1,
            )).scalar_one_or_none()
        return dict(config or {})
    finally:
        engine.dispose()


def _snapshot(config: dict[str, Any]) -> CredentialSnapshot:
    raw_expires = config.get("CODEX_TOKEN_EXPIRES")
    try:
        expires = int(raw_expires) if raw_expires else None
    except (TypeError, ValueError):
        expires = None
    return CredentialSnapshot(
        revision=int(config.get(REVISION_KEY, 0)),
        access_token=str(config.get("CODEX_ACCESS_TOKEN") or ""),
        refresh_token=str(config.get("CODEX_REFRESH_TOKEN") or ""),
        account_id=config.get("CODEX_ACCOUNT_ID") or None,
        expires=expires,
        config=MappingProxyType(dict(config)),
    )


def current_credentials() -> CredentialSnapshot:
    with _condition:
        return _snapshot(read_provider_snapshot())


def ensure_current(snapshot: CredentialSnapshot) -> None:
    current = current_credentials()
    if current.identity != snapshot.identity or current.access_token != snapshot.access_token:
        raise HTTPException(status_code=409, detail="ChatGPT credentials changed. Retry the operation.")


def _mirror(config: dict[str, Any]) -> None:
    from services.provider_settings import _mirror_to_legacy_file
    # Mirror a complete config, not only credentials: a settings commit may be
    # waiting to mirror while this newer credential commit already includes it.
    config = _mirror_to_legacy_file(config)
    # Environment is compatibility state only; DB snapshots own credential reads.
    for key in CREDENTIAL_FIELDS | {"CODEX_MODEL"}:
        value = config.get(key)
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = str(value)


def _commit(expected: CredentialSnapshot, updates: dict[str, Any]) -> CredentialSnapshot:
    engine = _engine()
    try:
        for _ in range(3):
            with engine.begin() as connection:
                table = ProviderSettings.__table__
                row = connection.execute(select(table.c.config, table.c.updated_at).where(table.c.id == 1).with_for_update()).first()
                config = dict(row.config or {}) if row else {}
                current = _snapshot(config)
                if current.identity != expected.identity or current.access_token != expected.access_token:
                    raise HTTPException(status_code=409, detail="ChatGPT credentials changed. Retry the operation.")
                merged = {
                    **current.config, **updates,
                    REVISION_KEY: current.revision + 1,
                    CONFIG_REVISION_KEY: int(config.get(CONFIG_REVISION_KEY, 0)) + 1,
                }
                values = {"config": merged, "updated_at": get_current_utc_datetime()}
                if row is None:
                    connection.execute(table.insert().values(id=1, **values))
                else:
                    updated = connection.execute(table.update().where(
                        table.c.id == 1, table.c.updated_at == row.updated_at,
                        func.coalesce(table.c.config[REVISION_KEY].as_integer(), 0) == expected.revision,
                        func.coalesce(table.c.config["CODEX_ACCESS_TOKEN"].as_string(), "") == expected.access_token,
                        func.coalesce(table.c.config["CODEX_REFRESH_TOKEN"].as_string(), "") == expected.refresh_token,
                    ).values(**values))
                    if updated.rowcount != 1:
                        # A settings-only write may race SQLite's ignored FOR
                        # UPDATE. Re-read and merge without repeating token HTTP.
                        continue
            _mirror(merged)
            return _snapshot(merged)
        raise HTTPException(status_code=409, detail="Provider settings changed. Retry the operation.")
    finally:
        engine.dispose()


def store_token(result: TokenSuccess, *, expected: CredentialSnapshot | None = None):
    profile = get_account_profile(result.access, result.id_token)
    with _condition:
        snapshot = expected or current_credentials()
        committed = _commit(snapshot, {
            "CODEX_ACCESS_TOKEN": result.access,
            "CODEX_REFRESH_TOKEN": result.refresh,
            "CODEX_TOKEN_EXPIRES": str(result.expires),
            "CODEX_ACCOUNT_ID": profile.account_id or "",
            "CODEX_USERNAME": profile.username or "",
            "CODEX_EMAIL": profile.email or "",
            "CODEX_IS_PRO": profile.is_pro,
        })
        _condition.notify_all()
    return committed, profile


def logout() -> None:
    with _condition:
        _commit(current_credentials(), {**{key: "" for key in CREDENTIAL_FIELDS}, "CODEX_MODEL": ""})
        _condition.notify_all()


def refresh_credentials(*, force: bool = False) -> CredentialSnapshot:
    with _condition:
        while True:
            snapshot = current_credentials()
            if not snapshot.access_token:
                raise auth_required()
            expired = snapshot.expires is not None and snapshot.expires <= int(time.time() * 1000) + 60_000
            if not force and not expired:
                return snapshot
            if not snapshot.refresh_token:
                raise auth_required()
            if snapshot.identity not in _refreshing:
                _refreshing.add(snapshot.identity)
                break
            waiting_for = snapshot.identity
            while waiting_for in _refreshing:
                _condition.wait()
            after_wait = current_credentials()
            if after_wait.identity == waiting_for and after_wait.access_token == snapshot.access_token:
                raise auth_required()
            # Another request's successful refresh already satisfies this request.
            force = False
    try:
        result = refresh_access_token(snapshot.refresh_token)
        with _condition:
            current = current_credentials()
            if current.identity != snapshot.identity or current.access_token != snapshot.access_token:
                if current.access_token:
                    return current
                raise auth_required()
            if not isinstance(result, TokenSuccess):
                raise auth_required()
            refreshed, _ = store_token(result, expected=snapshot)
            return refreshed
    finally:
        with _condition:
            _refreshing.discard(snapshot.identity)
            _condition.notify_all()
