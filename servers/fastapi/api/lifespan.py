from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI

from migrations import migrate_database_on_startup
from services.database import async_session_maker, create_db_and_tables, dispose_engines
from services.provider_settings import migrate_provider_settings_from_file
from templates.default_templates import import_default_templates_on_startup
from utils.get_env import get_app_data_directory_env, get_can_change_keys_env
from utils.model_availability import (
    check_llm_and_image_provider_api_or_model_availability,
)
from utils.user_config import update_env_with_user_config
from api.v1.auth.bootstrap import bootstrap_database_admin

logger = logging.getLogger(__name__)


def _configure_application_logging() -> None:
    """Honor LOG_LEVEL (default INFO) so template/export diagnostics are visible."""
    raw = (os.getenv("LOG_LEVEL") or "INFO").strip().upper()
    level = getattr(logging, raw, logging.INFO)
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    if root_logger.handlers:
        return

    logger_cursor: logging.Logger | None = logging.getLogger("uvicorn.error")
    visible_handlers: list[logging.Handler] = []
    while logger_cursor is not None:
        visible_handlers.extend(logger_cursor.handlers)
        if not logger_cursor.propagate:
            break
        logger_cursor = logger_cursor.parent

    for handler in visible_handlers:
        root_logger.addHandler(handler)

    if not root_logger.handlers:
        logging.basicConfig(level=level)


@asynccontextmanager
async def app_lifespan(_: FastAPI):
    """
    Lifespan context manager for FastAPI application.
    Initializes the application data directory, runs Alembic migrations when
    MIGRATE_DATABASE_ON_STARTUP=true, creates any missing tables, bootstraps
    the primary administrator from legacy/env credentials (if provided), and checks LLM model
    availability.
    """
    _configure_application_logging()
    os.makedirs(get_app_data_directory_env(), exist_ok=True)
    await migrate_database_on_startup()
    await create_db_and_tables()
    await bootstrap_database_admin()
    async with async_session_maker() as session:
        await migrate_provider_settings_from_file(session)
    await import_default_templates_on_startup()
    if get_can_change_keys_env() != "false":
        update_env_with_user_config()
    await check_llm_and_image_provider_api_or_model_availability()
    yield
    # Shutdown: release all database connections to prevent stale/leaked pools.
    await dispose_engines()
