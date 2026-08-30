import logging
from typing import Any

from sqlalchemy import create_engine, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.sql.provider_settings import ProviderSettings
from utils.datetime_utils import get_current_utc_datetime
from utils.db_utils import get_database_url_and_connect_args, to_sync_sqlalchemy_url
from utils.get_env import get_user_config_path_env
from utils.user_config_store import read_user_config_file, update_user_config_file


logger = logging.getLogger(__name__)

PROVIDER_SETTINGS_ID = 1
CODEX_MANAGED_FIELDS = {
    "CODEX_ACCESS_TOKEN",
    "CODEX_REFRESH_TOKEN",
    "CODEX_TOKEN_EXPIRES",
    "CODEX_ACCOUNT_ID",
    "CODEX_USERNAME",
    "CODEX_EMAIL",
    "CODEX_IS_PRO",
}
PRESENTON_STATUS_FIELDS = {
    "PRESENTON_CONNECTED",
    "PRESENTON_EMAIL",
}
OAUTH_MANAGED_FIELDS = CODEX_MANAGED_FIELDS | PRESENTON_STATUS_FIELDS
EMPTY_VALUE_PRESERVED_FIELDS = {
    "OPEN_WEBUI_IMAGE_URL",
    "OPEN_WEBUI_IMAGE_API_KEY",
    "CODEX_MODEL",
}
OPTIONAL_ADVANCED_FIELDS = {
    "LLM_GENERATION_PROFILE",
    "LLM_MAX_OUTPUT_TOKENS",
    "LLM_REASONING_MODE",
    "LLM_REASONING_EFFORT",
    "LLM_REASONING_BUDGET_TOKENS",
    "DISABLE_THINKING",
    "EXTENDED_REASONING",
    "OPENROUTER_PROVIDER_ORDER",
    "OPENROUTER_ALLOW_FALLBACKS",
    "OPENROUTER_REQUIRE_PARAMETERS",
    "OPENROUTER_DATA_COLLECTION",
    "OPENROUTER_ZDR",
}


def sanitize_provider_settings(config: dict[str, Any]) -> dict[str, Any]:
    """Keep provider/runtime settings and exclude every legacy auth field."""
    return {
        key: value
        for key, value in config.items()
        if not key.upper().startswith("AUTH_")
    }


def merge_provider_settings(
    existing: dict[str, Any], incoming: dict[str, Any]
) -> dict[str, Any]:
    """Preserve the previous settings API's patch and managed-token behavior."""
    sanitized = sanitize_provider_settings(incoming)
    merged = {**sanitize_provider_settings(existing), **sanitized}

    for key in OAUTH_MANAGED_FIELDS:
        if key in existing:
            merged[key] = existing[key]
        else:
            merged.pop(key, None)

    for key in EMPTY_VALUE_PRESERVED_FIELDS:
        if not sanitized.get(key) and key in existing:
            merged[key] = existing[key]

    for key in OPTIONAL_ADVANCED_FIELDS:
        if key in sanitized and sanitized[key] in (None, "", []):
            merged.pop(key, None)

    return merged


def _mirror_to_legacy_file(config: dict[str, Any]) -> None:
    """Mirror DB settings for code paths that still consume userConfig.json."""
    path = get_user_config_path_env()
    if not path:
        return

    def replace_provider_config(existing: dict[str, Any]) -> dict[str, Any]:
        mirrored = dict(config)
        # Authentication is database-backed now, but the compatibility file is
        # also the rollback/recovery copy. Never discard its credential fields.
        for key, value in existing.items():
            if key.upper().startswith("AUTH_"):
                mirrored[key] = value
        return mirrored

    update_user_config_file(path, replace_provider_config)


async def migrate_provider_settings_from_file(session: AsyncSession) -> dict[str, Any]:
    """One-time startup import, followed by DB-to-file compatibility syncing."""
    row = await session.get(ProviderSettings, PROVIDER_SETTINGS_ID)
    path = get_user_config_path_env()

    if row is None:
        legacy_config = read_user_config_file(path) if path else {}
        row = ProviderSettings(
            id=PROVIDER_SETTINGS_ID,
            config=sanitize_provider_settings(legacy_config),
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        logger.info("Migrated provider settings from userConfig.json into the database.")
    else:
        sanitized = sanitize_provider_settings(dict(row.config or {}))
        if sanitized != row.config:
            row.config = sanitized
            row.updated_at = get_current_utc_datetime()
            await session.commit()

    config = dict(row.config or {})
    _mirror_to_legacy_file(config)
    return config


async def get_provider_settings(session: AsyncSession) -> dict[str, Any]:
    row = await session.get(ProviderSettings, PROVIDER_SETTINGS_ID)
    if row is None:
        return await migrate_provider_settings_from_file(session)
    return sanitize_provider_settings(dict(row.config or {}))


async def save_provider_settings(
    session: AsyncSession, incoming: dict[str, Any]
) -> dict[str, Any]:
    row = await session.get(ProviderSettings, PROVIDER_SETTINGS_ID)
    if row is None:
        existing: dict[str, Any] = {}
        row = ProviderSettings(id=PROVIDER_SETTINGS_ID, config={})
        session.add(row)
    else:
        existing = dict(row.config or {})

    row.config = merge_provider_settings(existing, incoming)
    row.updated_at = get_current_utc_datetime()
    await session.commit()
    await session.refresh(row)

    config = dict(row.config or {})
    _mirror_to_legacy_file(config)
    return config


def sync_legacy_file_to_provider_settings() -> None:
    """Persist changes made by remaining synchronous userConfig writers.

    Codex token refresh currently occurs in synchronous provider code, so this
    narrow compatibility bridge keeps those rare writes in the DB as well.
    """
    path = get_user_config_path_env()
    if not path:
        return
    config = sanitize_provider_settings(read_user_config_file(path))
    database_url, _ = get_database_url_and_connect_args()
    engine = create_engine(to_sync_sqlalchemy_url(database_url))
    try:
        with engine.begin() as connection:
            table = ProviderSettings.__table__
            exists = connection.execute(
                select(table.c.id).where(table.c.id == PROVIDER_SETTINGS_ID)
            ).scalar_one_or_none()
            values = {
                "config": config,
                "updated_at": get_current_utc_datetime(),
            }
            if exists is None:
                connection.execute(
                    table.insert().values(id=PROVIDER_SETTINGS_ID, **values)
                )
            else:
                connection.execute(
                    table.update()
                    .where(table.c.id == PROVIDER_SETTINGS_ID)
                    .values(**values)
                )
    finally:
        engine.dispose()
