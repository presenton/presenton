import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text

from utils.db_utils import get_database_url_and_connect_args
from utils.get_env import get_migrate_database_on_startup_env


LEGACY_BASELINE_REVISION = "00b3c27a13bc"
# Revision before 95b5127e93cd (template_create_infos); used when DB has theme but not that table.
REVISION_BEFORE_TEMPLATE_CREATE_INFO = "82abdbc476a7"


async def migrate_database_on_startup() -> None:
    if get_migrate_database_on_startup_env() not in ["true", "True"]:
        return

    try:
        await asyncio.to_thread(_run_migrations)
        print("Migrations run successfully", flush=True)
    except Exception as exc:
        print(f"Error running migrations: {exc}", flush=True)
        raise


def _to_sync_database_url(database_url: str) -> str:
    # Preserve slash counts for sqlite URLs so Windows paths stay valid.
    if database_url.startswith("sqlite+aiosqlite:///"):
        return "sqlite:///" + database_url[len("sqlite+aiosqlite:///") :]
    if database_url.startswith("postgresql+asyncpg://"):
        return "postgresql://" + database_url[len("postgresql+asyncpg://") :]
    if database_url.startswith("mysql+aiomysql://"):
        return "mysql://" + database_url[len("mysql+aiomysql://") :]
    return database_url


def _run_migrations() -> None:
    # migrations.py lives at servers/fastapi/migrations.py
    # so parents[0] = servers/fastapi/, where alembic/ lives alongside it.
    base_dir = Path(__file__).resolve().parents[0]
    config = Config()
    config.set_main_option("script_location", str(base_dir / "alembic"))

    database_url, _ = get_database_url_and_connect_args()

    # Alembic uses synchronous engines; strip async driver prefixes.
    database_url = _to_sync_database_url(database_url)

    config.set_main_option("sqlalchemy.url", database_url)
    _repair_orphan_alembic_revision(config, database_url)
    _stamp_legacy_database_if_needed(config, database_url)

    try:
        command.upgrade(config, "head")
    except Exception:
        # Safety net for edge cases; legacy DBs are stamped proactively above.
        if _is_unversioned_populated_database(database_url):
            _stamp_legacy_database_if_needed(config, database_url)
            command.upgrade(config, "head")
            return
        raise


def _repair_orphan_alembic_revision(config: Config, database_url: str) -> None:
    """
    If alembic_version points at a revision id that no longer exists in alembic/versions
    (removed branch, old image, etc.), re-stamp from the live schema so upgrade can run.
    """
    script = ScriptDirectory.from_config(config)
    known = {rev.revision for rev in script.walk_revisions()}
    heads = script.get_heads()
    if len(heads) != 1:
        return
    head = heads[0]

    engine = create_engine(database_url)
    try:
        with engine.connect() as connection:
            inspector = inspect(connection)
            tables = set(inspector.get_table_names())
            if "alembic_version" not in tables:
                return
            version_num = connection.execute(
                text("SELECT version_num FROM alembic_version LIMIT 1")
            ).scalar_one_or_none()
            if not version_num or version_num in known:
                return
            print(
                f"Alembic revision {version_num!r} is missing from the codebase; "
                "inferring applied migrations from schema and re-stamping.",
                flush=True,
            )
            target = _infer_revision_from_schema(inspector, tables, head)
            command.stamp(config, target)
    finally:
        engine.dispose()


def _infer_revision_from_schema(inspector, tables: set[str], head_revision: str) -> str:
    """Best-effort: map existing SQLite/Postgres schema to our linear migration chain."""
    if "template_create_infos" in tables:
        return head_revision
    if "presentations" in tables:
        cols = {c["name"] for c in inspector.get_columns("presentations")}
        if "theme" in cols:
            return REVISION_BEFORE_TEMPLATE_CREATE_INFO
    return LEGACY_BASELINE_REVISION


def _stamp_legacy_database_if_needed(config: Config, database_url: str) -> None:
    """
    If the DB has app tables but no migration reference in alembic_version,
    treat it as a legacy DB and stamp baseline before upgrading.
    """
    if not _is_unversioned_populated_database(database_url):
        return

    script = ScriptDirectory.from_config(config)
    known_revisions = {rev.revision for rev in script.walk_revisions()}
    baseline_revision = (
        LEGACY_BASELINE_REVISION
        if LEGACY_BASELINE_REVISION in known_revisions
        else script.get_base()
    )
    print(
        "Detected legacy database without migration reference. "
        f"Stamping revision to {baseline_revision} before upgrading.",
        flush=True,
    )
    command.stamp(config, baseline_revision)


def _is_unversioned_populated_database(database_url: str) -> bool:
    known_app_tables = {
        "presentations",
        "slides",
        "templates",
        "keyvaluesqlmodel",
        "imageasset",
        "presentation_layout_codes",
        "async_presentation_generation_tasks",
        "webhook_subscriptions",
    }
    engine = create_engine(database_url)
    try:
        with engine.connect() as connection:
            inspector = inspect(connection)
            table_names = set(inspector.get_table_names())
            has_alembic_version_table = "alembic_version" in table_names
            has_applied_revision = False
            if has_alembic_version_table:
                revision_count = connection.execute(
                    text("SELECT COUNT(*) FROM alembic_version")
                ).scalar_one()
                has_applied_revision = revision_count > 0
            has_known_app_tables = len(table_names.intersection(known_app_tables)) > 0
            return has_known_app_tables and not has_applied_revision
    finally:
        engine.dispose()
