from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI

from migrations import migrate_database_on_startup
from services.database import create_db_and_tables, dispose_engines
from utils.get_env import get_app_data_directory_env
from utils.model_availability import (
    check_llm_and_image_provider_api_or_model_availability,
)
from utils.simple_auth import (
    clear_stored_credentials,
    force_set_credentials,
    is_auth_configured,
    setup_initial_credentials,
)

logger = logging.getLogger(__name__)


def _is_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _bootstrap_auth_from_env() -> None:
    """
    Bootstrap the single-user login from environment variables.

    Behaviour:
      - RESET_AUTH=true         -> wipe stored credentials (recovery path).
      - AUTH_USERNAME + AUTH_PASSWORD set:
          * if no credentials configured   -> create them (first-run preseed).
          * if AUTH_OVERRIDE_FROM_ENV=true -> overwrite existing credentials.
      - Otherwise do nothing; the login UI will run in setup-mode on first
        visit and in sign-in-mode afterwards.

    Any errors here are logged and swallowed so a bad env value can never
    brick the app — the operator can always fall back to the UI/reset flow.
    """
    try:
        if _is_truthy(os.getenv("RESET_AUTH")):
            clear_stored_credentials()
            logger.warning(
                "RESET_AUTH is set; cleared stored login credentials. "
                "The next visit will prompt for setup."
            )

        env_username = os.getenv("AUTH_USERNAME")
        env_password = os.getenv("AUTH_PASSWORD")
        if not env_username or not env_password:
            return

        override = _is_truthy(os.getenv("AUTH_OVERRIDE_FROM_ENV"))
        if is_auth_configured() and not override:
            return

        if is_auth_configured() and override:
            force_set_credentials(env_username, env_password)
            logger.warning(
                "AUTH_OVERRIDE_FROM_ENV is set; replaced stored credentials "
                "with values from AUTH_USERNAME/AUTH_PASSWORD."
            )
        else:
            setup_initial_credentials(env_username, env_password)
            logger.info(
                "Initialized login credentials from AUTH_USERNAME/AUTH_PASSWORD."
            )
    except Exception as exc:  # pragma: no cover - defensive, never fatal.
        logger.exception("Failed to bootstrap auth from environment: %s", exc)


@asynccontextmanager
async def app_lifespan(_: FastAPI):
    """
    Lifespan context manager for FastAPI application.
    Initializes the application data directory, runs Alembic migrations when
    MIGRATE_DATABASE_ON_STARTUP=true, creates any missing tables, bootstraps
    the single-user login from env vars (if provided), and checks LLM model
    availability.
    """
    os.makedirs(get_app_data_directory_env(), exist_ok=True)
    await migrate_database_on_startup()
    await create_db_and_tables()
    _bootstrap_auth_from_env()
    await check_llm_and_image_provider_api_or_model_availability()
    yield
    # Shutdown: release all database connections to prevent stale/leaked pools.
    await dispose_engines()
