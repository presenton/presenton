import asyncio
import json
import time

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from models.sql.provider_settings import ProviderSettings
from services import codex_credentials, configured_llm, provider_settings
from services.codex_models import CodexModel
from utils.datetime_utils import get_current_utc_datetime
from utils.user_config_store import read_user_config_file, update_user_config_file


@pytest.fixture
def settings_store(monkeypatch, tmp_path):
    database = str(tmp_path / "settings.db")
    url = "sqlite:///" + database
    engine = create_engine(url)
    ProviderSettings.__table__.create(engine)
    initial = {
        "LLM": "codex", "CODEX_MODEL": "old-model", "CODEX_ACCESS_TOKEN": "test-access",
        "CODEX_REFRESH_TOKEN": "test-refresh", "CODEX_ACCOUNT_ID": "test-account",
        "CODEX_TOKEN_EXPIRES": str(int(time.time() * 1000) + 3600000),
    }
    with engine.begin() as connection:
        connection.execute(ProviderSettings.__table__.insert().values(id=1, config=initial, updated_at=get_current_utc_datetime()))
    engine.dispose()
    path = str(tmp_path / "userConfig.json")
    update_user_config_file(path, lambda _: dict(initial))
    monkeypatch.setenv("USER_CONFIG_PATH", path)
    monkeypatch.setenv("CODEX_MODEL", "env-selected-model")
    monkeypatch.setattr(codex_credentials, "_engine", lambda: create_engine(url))
    monkeypatch.setattr(configured_llm, "fetch_catalog", lambda *args: (
        CodexModel(id="old-model", name="Old", supported_reasoning_levels=("low",)),
        CodexModel(id="new-model", name="New", supported_reasoning_levels=("low", "ultra")),
    ))
    return database, path, initial


def save(database, incoming):
    async def operation():
        engine = create_async_engine("sqlite+aiosqlite:///" + database)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                return await provider_settings.save_provider_settings(session, incoming)
        finally:
            await engine.dispose()
    return asyncio.run(operation())


@pytest.mark.parametrize("change", [
    {"CODEX_MODEL": "removed"}, {"LLM_REASONING_EFFORT": "ultra"},
    {"LLM_MAX_OUTPUT_TOKENS": "-1"}, {"LLM_CONTEXT_WINDOW": []},
])
def test_rejected_candidate_changes_neither_db_file_nor_environment(settings_store, change):
    import os
    database, path, initial = settings_store
    before = open(path, "rb").read()
    with pytest.raises(HTTPException) as error:
        save(database, change)
    assert error.value.status_code == 400
    assert codex_credentials.read_provider_snapshot() == initial
    assert open(path, "rb").read() == before
    assert os.environ["CODEX_MODEL"] == "env-selected-model"


def test_valid_change_commits_the_exact_new_model(settings_store):
    database, path, initial = settings_store
    saved = save(database, {"CODEX_MODEL": "new-model", "LLM_REASONING_EFFORT": "low"})
    assert saved["CODEX_MODEL"] == "new-model"
    assert saved["LLM_REASONING_EFFORT"] == "low"
    assert read_user_config_file(path)["CODEX_MODEL"] == "new-model"
    assert codex_credentials.read_provider_snapshot()["CODEX_MODEL"] == "new-model"


def test_unrelated_settings_do_not_require_catalog(settings_store, monkeypatch):
    database, _, _ = settings_store
    def no_discovery(*args):
        raise AssertionError("Unrelated image setting must not fetch Codex catalog")
    monkeypatch.setattr(configured_llm, "fetch_catalog", no_discovery)
    assert save(database, {"IMAGE_PROVIDER": "pexels"})["IMAGE_PROVIDER"] == "pexels"


def test_internal_revision_is_not_user_writable(settings_store):
    database, _, _ = settings_store
    saved = save(database, {codex_credentials.REVISION_KEY: 999, codex_credentials.CONFIG_REVISION_KEY: 999})
    assert codex_credentials.REVISION_KEY not in saved
    assert saved[codex_credentials.CONFIG_REVISION_KEY] == 1


def test_admin_catalog_response_has_no_cache_or_credentials(monkeypatch):
    from api.v1.admin import router
    app = FastAPI()
    app.include_router(router.API_V1_ADMIN_ROUTER)
    app.dependency_overrides[router.require_settings_admin] = lambda: None
    monkeypatch.setattr(router, "discover_models", lambda: (CodexModel(id="new-model", name="New"),))
    with TestClient(app) as client:
        response = client.get("/api/v1/admin/codex/models")
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, no-store"
    assert response.json()["models"][0]["id"] == "new-model"
    assert response.json()["client_version"] == "0.169.0"
    assert "token" not in response.text
    assert "account" not in response.text
    assert codex_credentials.REVISION_KEY not in response.text


def test_late_settings_mirror_preserves_newer_logout_model(settings_store):
    _, path, initial = settings_store
    update_user_config_file(path, lambda existing: {**existing, "CODEX_MODEL": "", "CODEX_ACCESS_TOKEN": "", codex_credentials.REVISION_KEY: 1})
    provider_settings._mirror_to_legacy_file(initial)
    assert read_user_config_file(path)["CODEX_MODEL"] == ""
    assert read_user_config_file(path)["CODEX_ACCESS_TOKEN"] == ""
