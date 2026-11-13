import time
import threading
import os
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine

from models.sql.provider_settings import ProviderSettings
from services import codex_credentials as credentials
from utils.oauth.openai_codex import CodexAccountProfile, TokenSuccess
from utils.datetime_utils import get_current_utc_datetime
from utils.user_config_store import read_user_config_file, update_user_config_file


@pytest.mark.parametrize("scheme", ["postgresql", "postgresql+asyncpg"])
def test_sync_engine_preserves_dsn_tls_options_without_pg_environment(monkeypatch, scheme):
    monkeypatch.setenv(
        "DATABASE_URL",
        f"{scheme}://fixture:fixture@db.example/presenton"
        "?sslmode=verify-full&sslrootcert=%2Ffixture%2Fca.pem&connect_timeout=5",
    )
    monkeypatch.delenv("PGSSLMODE", raising=False)
    monkeypatch.delenv("PGSSLROOTCERT", raising=False)
    def reject_async_helper():
        raise AssertionError("The async helper would discard the DSN query")
    monkeypatch.setattr(credentials, "get_database_url_and_connect_args", reject_async_helper)

    engine = credentials._engine()
    try:
        _, options = engine.dialect.create_connect_args(engine.url)
        assert engine.dialect.driver == "psycopg"
        assert options["sslmode"] == "verify-full"
        assert options["sslrootcert"] == "/fixture/ca.pem"
        assert options["connect_timeout"] == "5"
        assert engine.hide_parameters is True
    finally:
        engine.dispose()


def test_sync_engine_keeps_default_sqlite_path_initialization(monkeypatch, tmp_path):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    app_data = tmp_path / "new-app-data"
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(app_data))
    engine = credentials._engine()
    try:
        assert engine.url.database == str(app_data / "fastapi.db")
        ProviderSettings.__table__.create(engine)
    finally:
        engine.dispose()
    assert credentials.read_provider_snapshot() == {}


@pytest.fixture
def credential_store(monkeypatch, tmp_path):
    url = "sqlite:///" + str(tmp_path / "credentials.db")
    engine = create_engine(url)
    ProviderSettings.__table__.create(engine)
    initial = {
        "LLM": "codex", "CODEX_MODEL": "new-account-model", "CODEX_ACCESS_TOKEN": "old-access",
        "CODEX_REFRESH_TOKEN": "old-refresh", "CODEX_ACCOUNT_ID": "account-a", "CODEX_TOKEN_EXPIRES": "1",
    }
    with engine.begin() as connection:
        connection.execute(ProviderSettings.__table__.insert().values(id=1, config=initial, updated_at=get_current_utc_datetime()))
    engine.dispose()
    path = str(tmp_path / "userConfig.json")
    update_user_config_file(path, lambda _: dict(initial))
    monkeypatch.setenv("USER_CONFIG_PATH", path)
    for key in credentials.CREDENTIAL_FIELDS | {"CODEX_MODEL"}:
        monkeypatch.setenv(key, os.environ.get(key, ""))
    monkeypatch.setattr(credentials, "_engine", lambda: create_engine(url))
    monkeypatch.setattr(credentials, "get_account_profile", lambda *args: CodexAccountProfile(account_id="account-a"))
    yield path


def token(access="new-access"):
    return TokenSuccess(access=access, refresh="new-refresh", expires=int(time.time() * 1000) + 3600000)


def test_concurrent_refresh_is_singleflight(monkeypatch, credential_store):
    calls = []
    def refresh(_):
        calls.append(1)
        time.sleep(0.05)
        return token()
    monkeypatch.setattr(credentials, "refresh_access_token", refresh)
    with ThreadPoolExecutor(max_workers=8) as executor:
        snapshots = list(executor.map(lambda _: credentials.refresh_credentials(), range(8)))
    assert len(calls) == 1
    assert {snapshot.access_token for snapshot in snapshots} == {"new-access"}
    assert {snapshot.revision for snapshot in snapshots} == {1}


@pytest.mark.parametrize("transition", ["logout", "login"])
def test_old_account_refresh_cannot_undo_later_transition(monkeypatch, credential_store, transition):
    started, release = threading.Event(), threading.Event()
    def refresh(_):
        started.set()
        assert release.wait(5)
        return token("obsolete-refresh-result")
    monkeypatch.setattr(credentials, "refresh_access_token", refresh)
    with ThreadPoolExecutor(max_workers=1) as executor:
        pending = executor.submit(credentials.refresh_credentials)
        assert started.wait(5)
        if transition == "logout":
            credentials.logout()
        else:
            credentials.store_token(token("new-login"))
        release.set()
        if transition == "logout":
            with pytest.raises(HTTPException):
                pending.result()
        else:
            assert pending.result().access_token == "new-login"
    current = credentials.current_credentials()
    assert current.access_token == ("" if transition == "logout" else "new-login")
    assert read_user_config_file(credential_store)["CODEX_ACCESS_TOKEN"] == current.access_token


def test_stale_login_cannot_replace_another_login(credential_store):
    original = credentials.current_credentials()
    credentials.store_token(token("new-login"), expected=original)
    with pytest.raises(HTTPException) as error:
        credentials.store_token(token("obsolete-login"), expected=original)
    assert error.value.status_code == 409
    assert credentials.current_credentials().access_token == "new-login"


def test_late_mirror_does_not_resurrect_older_credentials(credential_store):
    old = dict(credentials.current_credentials().config)
    credentials.logout()
    credentials._mirror(old)
    assert read_user_config_file(credential_store)["CODEX_ACCESS_TOKEN"] == ""
    assert credentials.current_credentials().revision == 1


def test_credentials_repr_never_contains_tokens(credential_store):
    representation = repr(credentials.current_credentials())
    assert "old-access" not in representation
    assert "old-refresh" not in representation
    assert "account-a" not in representation


def test_sqlite_cas_remerges_a_racing_settings_commit_without_repeating_http(monkeypatch, credential_store):
    expected = credentials.current_credentials()
    original_snapshot = credentials._snapshot
    interleaved = []
    def snapshot_after_select(config):
        result = original_snapshot(config)
        if not interleaved:
            interleaved.append(True)
            engine = credentials._engine()
            try:
                with engine.begin() as connection:
                    connection.execute(ProviderSettings.__table__.update().where(ProviderSettings.__table__.c.id == 1).values(
                        config={**config, "CODEX_MODEL": "new-user-selection", "LLM_REASONING_EFFORT": "low", credentials.CONFIG_REVISION_KEY: 1},
                        updated_at=get_current_utc_datetime(),
                    ))
            finally:
                engine.dispose()
        return result
    monkeypatch.setattr(credentials, "_snapshot", snapshot_after_select)
    committed = credentials._commit(expected, {"CODEX_ACCESS_TOKEN": "refreshed-access"})
    assert committed.config["CODEX_MODEL"] == "new-user-selection"
    assert committed.config["LLM_REASONING_EFFORT"] == "low"
    assert committed.config[credentials.CONFIG_REVISION_KEY] == 2
    assert committed.revision == 1
    assert read_user_config_file(credential_store)["CODEX_MODEL"] == "new-user-selection"
    assert read_user_config_file(credential_store)["LLM_REASONING_EFFORT"] == "low"


@pytest.mark.parametrize("mirror", ["credentials", "settings"])
def test_delayed_mirror_cannot_overwrite_settings_at_same_credential_revision(credential_store, mirror):
    from services.provider_settings import _mirror_to_legacy_file
    committed, _ = credentials.store_token(token())
    old = dict(committed.config)
    newer = {**old, "CODEX_MODEL": "new-user-selection", "LLM_REASONING_EFFORT": "low", credentials.CONFIG_REVISION_KEY: 2}
    _mirror_to_legacy_file(newer)
    if mirror == "credentials":
        credentials._mirror(old)
        assert os.environ["CODEX_MODEL"] == "new-user-selection"
    else:
        _mirror_to_legacy_file(old)
    actual = read_user_config_file(credential_store)
    assert actual["CODEX_MODEL"] == "new-user-selection"
    assert actual["LLM_REASONING_EFFORT"] == "low"
    assert actual[credentials.CONFIG_REVISION_KEY] == 2


def test_explicit_logout_clears_model_in_db_file_and_environment(credential_store):
    credentials.logout()
    assert credentials.read_provider_snapshot()["CODEX_MODEL"] == ""
    assert read_user_config_file(credential_store)["CODEX_MODEL"] == ""
    assert os.environ["CODEX_MODEL"] == ""
