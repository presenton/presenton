import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlmodel import SQLModel

# Make sure all models can be imported when alembic runs standalone.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Import every SQL model so they register with SQLModel.metadata before
# autogenerate or migration execution reads it.
from models.sql.async_presentation_generation_status import (  # noqa: F401, E402
    AsyncPresentationGenerationTaskModel,
)
from models.sql.image_asset import ImageAsset  # noqa: F401, E402
from models.sql.key_value import KeyValueSqlModel  # noqa: F401, E402
from models.sql.ollama_pull_status import OllamaPullStatus  # noqa: F401, E402
from models.sql.presentation import PresentationModel  # noqa: F401, E402
from models.sql.presentation_layout_code import (  # noqa: F401, E402
    PresentationLayoutCodeModel,
)
from models.sql.slide import SlideModel  # noqa: F401, E402
from models.sql.template import TemplateModel  # noqa: F401, E402
from models.sql.template_create_info import TemplateCreateInfoModel  # noqa: F401, E402
from models.sql.webhook_subscription import WebhookSubscription  # noqa: F401, E402

alembic_config = context.config

if alembic_config.config_file_name is not None:
    fileConfig(alembic_config.config_file_name)

target_metadata = SQLModel.metadata

# alembic.ini sets this so Config validates; treat it as "unset" for URL resolution.
_CLI_PLACEHOLDER_DB_URL = "sqlite:///placeholder"


def _to_sync_database_url(database_url: str) -> str:
    # Preserve slash counts for sqlite URLs so Windows paths stay valid.
    if database_url.startswith("sqlite+aiosqlite:///"):
        return "sqlite:///" + database_url[len("sqlite+aiosqlite:///") :]
    if database_url.startswith("postgresql+asyncpg://"):
        return "postgresql://" + database_url[len("postgresql+asyncpg://") :]
    if database_url.startswith("mysql+aiomysql://"):
        return "mysql://" + database_url[len("mysql+aiomysql://") :]
    return database_url


def _get_url() -> str:
    """
    Prefer the URL injected by migrations.py via config.set_main_option,
    falling back to the DATABASE_URL environment variable or a local SQLite DB.
    """
    configured = alembic_config.get_main_option("sqlalchemy.url")
    if configured and configured != _CLI_PLACEHOLDER_DB_URL:
        return configured

    from utils.db_utils import get_database_url_and_connect_args

    url, _ = get_database_url_and_connect_args()
    return _to_sync_database_url(url)


def run_migrations_offline() -> None:
    """Generate SQL script without connecting to the database."""
    url = _get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against the live database."""
    configuration = dict(alembic_config.get_section(alembic_config.config_ini_section) or {})
    configuration["sqlalchemy.url"] = _get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
