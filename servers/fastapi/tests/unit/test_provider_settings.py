import asyncio

from models.sql.user import User
from services.provider_settings import (
    merge_provider_settings,
    migrate_provider_settings_from_file,
    sanitize_provider_settings,
)
from utils.user_config_store import read_user_config_file, update_user_config_file


class ProviderSettingsSession:
    def __init__(self):
        self.row = None

    async def get(self, _model, _key):
        return self.row

    def add(self, row):
        self.row = row

    async def commit(self):
        return None

    async def refresh(self, _row):
        return None


def test_user_table_has_username_and_no_email_column():
    columns = set(User.__table__.columns.keys())

    assert "username" in columns
    assert "email" not in columns


def test_provider_settings_exclude_all_legacy_auth_fields():
    assert sanitize_provider_settings(
        {
            "LLM": "openai",
            "AUTH_USERNAME": "admin",
            "AUTH_PASSWORD": "plain",
            "AUTH_PASSWORD_HASH": "hash",
            "AUTH_SECRET_KEY": "jwt-secret",
        }
    ) == {"LLM": "openai"}


def test_reset_advanced_settings_removes_only_optional_overrides():
    existing = {
        "LLM": "openrouter",
        "OPENROUTER_API_KEY": "key",
        "OPENROUTER_MODEL": "openai/gpt-4o",
        "LLM_MAX_OUTPUT_TOKENS": 65536,
        "LLM_REASONING_MODE": "enabled",
        "OPENROUTER_PROVIDER_ORDER": ["groq"],
    }

    merged = merge_provider_settings(
        existing,
        {
            "LLM_MAX_OUTPUT_TOKENS": "",
            "LLM_REASONING_MODE": "",
            "OPENROUTER_PROVIDER_ORDER": [],
        },
    )

    assert merged == {
        "LLM": "openrouter",
        "OPENROUTER_API_KEY": "key",
        "OPENROUTER_MODEL": "openai/gpt-4o",
    }


def test_startup_migrates_user_config_and_rewrites_compatibility_file(
    monkeypatch, tmp_path
):
    path = tmp_path / "userConfig.json"
    monkeypatch.setenv("USER_CONFIG_PATH", str(path))
    update_user_config_file(
        str(path),
        lambda _: {
            "AUTH_USERNAME": "admin",
            "AUTH_PASSWORD_HASH": "legacy-hash",
            "AUTH_SECRET_KEY": "jwt-secret",
            "LLM": "openai",
            "OPENAI_API_KEY": "provider-key",
        },
    )
    session = ProviderSettingsSession()

    migrated = asyncio.run(migrate_provider_settings_from_file(session))

    assert migrated == {
        "LLM": "openai",
        "OPENAI_API_KEY": "provider-key",
    }
    assert session.row.config == migrated
    assert read_user_config_file(str(path)) == {
        "LLM": "openai",
        "OPENAI_API_KEY": "provider-key",
        "AUTH_USERNAME": "admin",
        "AUTH_PASSWORD_HASH": "legacy-hash",
        "AUTH_SECRET_KEY": "jwt-secret",
    }


def test_startup_seeds_empty_provider_settings_from_env(monkeypatch, tmp_path):
    path = tmp_path / "userConfig.json"
    monkeypatch.setenv("USER_CONFIG_PATH", str(path))
    monkeypatch.setenv("LLM", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "or-key")
    monkeypatch.setenv("OPENROUTER_MODEL", "inclusionai/ling-3.0-flash-fin:free")
    monkeypatch.setenv("IMAGE_PROVIDER", "pexels")
    monkeypatch.setenv("PEXELS_API_KEY", "pexels-key")
    update_user_config_file(
        str(path),
        lambda _: {
            "AUTH_USERNAME": "administrator",
            "AUTH_PASSWORD_HASH": "legacy-hash",
            "AUTH_SECRET_KEY": "jwt-secret",
        },
    )
    session = ProviderSettingsSession()
    session.row = type(
        "Row",
        (),
        {"id": 1, "config": {}, "updated_at": None},
    )()

    migrated = asyncio.run(migrate_provider_settings_from_file(session))

    assert migrated["LLM"] == "openrouter"
    assert migrated["OPENROUTER_API_KEY"] == "or-key"
    assert migrated["OPENROUTER_MODEL"] == "inclusionai/ling-3.0-flash-fin:free"
    mirrored = read_user_config_file(str(path))
    assert mirrored["AUTH_USERNAME"] == "administrator"
    assert mirrored["LLM"] == "openrouter"
    assert mirrored["OPENROUTER_API_KEY"] == "or-key"
