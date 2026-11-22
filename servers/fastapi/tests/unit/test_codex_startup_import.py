import asyncio
import os
import time
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api import lifespan
from api.v1.ppt.endpoints import codex_auth
from models.sql.provider_settings import ProviderSettings
from models.user_config import UserConfig
from services import codex_credentials as credentials, configured_llm, provider_settings
from services.codex_models import CodexModel
from utils.datetime_utils import get_current_utc_datetime
from utils.oauth.openai_codex import TokenSuccess
from utils.user_config_store import read_user_config_file, update_user_config_file


INITIAL = {"LLM": "codex", "CODEX_MODEL": "fixture-model", "IMAGE_PROVIDER": "pexels"}


@pytest.fixture
def startup_store(tmp_path, monkeypatch):
    database = tmp_path / "settings.db"
    config_file = str(tmp_path / "userConfig.json")
    bundle = {
        "CODEX_ACCESS_TOKEN": "fixture-access",
        "CODEX_REFRESH_TOKEN": "fixture-refresh",
        "CODEX_TOKEN_EXPIRES": str(int(time.time() * 1000) + 600_000),
        "CODEX_ACCOUNT_ID": "fixture-account",
    }
    with patch.dict(os.environ):
        for key in provider_settings.CODEX_MANAGED_FIELDS:
            os.environ.pop(key, None)
        os.environ.update(bundle)
        os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{database}"
        os.environ["USER_CONFIG_PATH"] = config_file
        os.environ["APP_DATA_DIRECTORY"] = str(tmp_path)
        engine = create_engine(f"sqlite:///{database}")
        ProviderSettings.__table__.create(engine)

        def seed(config):
            with engine.begin() as connection:
                connection.execute(ProviderSettings.__table__.insert().values(
                    id=1, config=config, updated_at=get_current_utc_datetime(),
                ))
            update_user_config_file(config_file, lambda _: {**config, **bundle})

        async def noop(*args):
            pass

        for name in (
            "migrate_database_on_startup", "create_db_and_tables", "bootstrap_database_admin",
            "fail_interrupted_async_tasks", "import_default_templates_on_startup", "dispose_engines",
        ):
            monkeypatch.setattr(lifespan, name, noop)
        monkeypatch.setattr(lifespan, "_configure_application_logging", lambda: None)
        async_engine = create_async_engine(os.environ["DATABASE_URL"])
        sessions = async_sessionmaker(async_engine, expire_on_commit=False)
        monkeypatch.setattr(lifespan, "async_session_maker", sessions)
        monkeypatch.setattr(credentials, "refresh_access_token", lambda *args: pytest.fail("Unexpected OAuth refresh"))
        monkeypatch.setattr(configured_llm, "fetch_catalog", lambda *args: pytest.fail("Unexpected model discovery"))

        try:
            yield seed, bundle, config_file, sessions
        finally:
            asyncio.run(async_engine.dispose())
            engine.dispose()


def test_startup_import_restores_auth_discovery_and_refresh(startup_store, monkeypatch):
    seed, bundle, path, _ = startup_store
    seed({**INITIAL, "CODEX_USERNAME": "stale-name", credentials.CONFIG_REVISION_KEY: 7})
    monkeypatch.setenv("CODEX_IS_PRO", "false")

    async def exercise():
        async with lifespan.app_lifespan(FastAPI()):
            imported = {
                **INITIAL, **bundle, "CODEX_IS_PRO": False,
                credentials.REVISION_KEY: 1, credentials.CONFIG_REVISION_KEY: 8,
            }
            assert credentials.read_provider_snapshot() == imported
            assert read_user_config_file(path) == imported
            assert (await codex_auth.get_codex_auth_status()).status == "authenticated"

        monkeypatch.setenv("CODEX_ACCESS_TOKEN", "different-env-access")
        async with lifespan.app_lifespan(FastAPI()):
            assert credentials.read_provider_snapshot() == imported
            metadata = CodexModel(id=INITIAL["CODEX_MODEL"], name="Fixture")

            def load_catalog(access, account_id):
                assert (access, account_id) == (bundle["CODEX_ACCESS_TOKEN"], bundle["CODEX_ACCOUNT_ID"])
                return (metadata,)

            monkeypatch.setattr(configured_llm, "fetch_catalog", load_catalog)
            assert configured_llm.discover_models() == (metadata,)
            assert configured_llm.resolve_configured_llm().model == INITIAL["CODEX_MODEL"]

            def refresh(refresh_token):
                assert refresh_token == bundle["CODEX_REFRESH_TOKEN"]
                return TokenSuccess(access="next-access", refresh="next-refresh", expires=int(bundle["CODEX_TOKEN_EXPIRES"]))

            monkeypatch.setattr(credentials, "refresh_access_token", refresh)
            assert (await codex_auth.refresh_codex_token()).detail == "Token refreshed successfully"
            assert credentials.current_credentials().access_token == "next-access"
            assert credentials.current_credentials().revision == 2

    asyncio.run(exercise())


def test_logout_stays_cleared_when_startup_env_returns(startup_store):
    seed, bundle, path, _ = startup_store
    seed(INITIAL)

    async def exercise():
        async with lifespan.app_lifespan(FastAPI()):
            credentials.logout()
            cleared = credentials.read_provider_snapshot()
            assert cleared["CODEX_ACCESS_TOKEN"] == cleared["CODEX_REFRESH_TOKEN"] == cleared["CODEX_MODEL"] == ""
        os.environ.update(bundle)
        async with lifespan.app_lifespan(FastAPI()):
            assert (await codex_auth.get_codex_auth_status()).status == "not_authenticated"
            assert credentials.read_provider_snapshot() == cleared
            assert read_user_config_file(path) == cleared
            assert UserConfig(**cleared).CODEX_IS_PRO is None

    asyncio.run(exercise())


@pytest.mark.parametrize("stored", [
    {"CODEX_REFRESH_TOKEN": "stored-refresh"},
    {"CODEX_ACCESS_TOKEN": "stored-access"},
    {"CODEX_ACCESS_TOKEN": ""},
    {"CODEX_ACCESS_TOKEN": None},
    {credentials.REVISION_KEY: 1},
])
def test_existing_oauth_state_blocks_import(startup_store, stored):
    seed, _, path, _ = startup_store
    config = {**INITIAL, **stored}
    seed(config)

    async def exercise():
        async with lifespan.app_lifespan(FastAPI()):
            assert credentials.read_provider_snapshot() == config
            assert read_user_config_file(path) == config

    asyncio.run(exercise())


def test_settings_read_does_not_bootstrap_from_env(startup_store):
    _, _, _, sessions = startup_store
    # With no row and no compatibility file, the settings API initializes an
    # empty row without reading the startup environment.
    async def exercise():
        async with sessions() as session:
            assert "CODEX_ACCESS_TOKEN" not in await provider_settings.get_provider_settings(session)
        assert (await codex_auth.get_codex_auth_status()).status == "not_authenticated"

    asyncio.run(exercise())


def test_missing_environment_access_token_does_not_import_partial_bundle(startup_store):
    seed, _, path, _ = startup_store
    seed(INITIAL)
    os.environ.pop("CODEX_ACCESS_TOKEN")

    async def exercise():
        async with lifespan.app_lifespan(FastAPI()):
            assert credentials.read_provider_snapshot() == read_user_config_file(path) == INITIAL

    asyncio.run(exercise())


def test_concurrent_logout_wins_startup_import(startup_store, monkeypatch):
    seed, bundle, path, sessions = startup_store
    seed(INITIAL)

    async def exercise():
        async with sessions() as session:
            execute = session.execute
            calls = 0

            async def execute_after_logout(*args, **kwargs):
                nonlocal calls
                calls += 1
                await asyncio.to_thread(credentials.logout)
                return await execute(*args, **kwargs)

            monkeypatch.setattr(session, "execute", execute_after_logout)
            config = await provider_settings.migrate_provider_settings_from_file(session, codex_environment=bundle)
            assert calls == 1
            assert config["CODEX_ACCESS_TOKEN"] == config["CODEX_REFRESH_TOKEN"] == config["CODEX_MODEL"] == ""
            assert config[credentials.REVISION_KEY] == 1
            assert credentials.read_provider_snapshot() == read_user_config_file(path) == config

    asyncio.run(exercise())
