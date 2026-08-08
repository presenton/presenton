import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text

from utils.db_utils import get_database_url_and_connect_args, to_sync_sqlalchemy_url
from utils.get_env import get_migrate_database_on_startup_env


LEGACY_BASELINE_REVISION = "00b3c27a13bc"
# Revision before 95b5127e93cd (template_create_infos); used when DB has theme but not that table.
REVISION_BEFORE_TEMPLATE_CREATE_INFO = "82abdbc476a7"
REVISION_TEMPLATE_CREATE_INFO = "95b5127e93cd"
REVISION_CHAT_HISTORY = "c7b70d0f31b1"
REVISION_TEMPLATE_V2 = "6e4a1b2c3d5f"
REVISION_SLIDE_UI = "7f5b2c3d4e6a"
REVISION_MERGED_TEMPLATE_V2 = "8a6c4d2e1f30"
REVISION_PRESENTATION_FONTS = "9b2d1c4e5f6a"
REVISION_TEMPLATE_V2_CHAT_SCOPE = "1d9a4c7b8e2f"
REVISION_TEMPLATE_V2_LAYOUTS_OPTIONAL = "2c8f4a1b9d7e"
REVISION_FONT_UPLOADS = "5d7e9a1b2c3f"
REVISION_TEMPLATE_V2_ID_STRINGS = "3f2a1b4c5d6e"
REVISION_TEMPLATE_V2_IS_DEFAULT = "4b7c9d0e1f2a"
REVISION_ASYNC_TASKS = "a7d4c9e2f1b3"
REVISION_ASYNC_TASK_STATUS_NORMALIZED = "b8e2f4a7c9d1"
REVISION_MULTI_USER_AUTH = "c9f1a2b3d4e5"
REVISION_USERNAME_PROVIDER_SETTINGS = "d0a2b4c6e8f1"
REVISION_PRIMARY_ADMIN_SLOT = "e1b3c5d7f9a2"


async def migrate_database_on_startup() -> None:
    if get_migrate_database_on_startup_env() not in ["true", "True"]:
        return

    try:
        await asyncio.to_thread(_run_migrations)
        print("Migrations run successfully", flush=True)
    except Exception as exc:
        print(f"Error running migrations: {exc}", flush=True)
        raise


def _run_migrations() -> None:
    # migrations.py lives at servers/fastapi/migrations.py
    # so parents[0] = servers/fastapi/, where alembic/ lives alongside it.
    base_dir = Path(__file__).resolve().parents[0]
    config = Config()
    config.set_main_option("script_location", str(base_dir / "alembic"))

    database_url, _ = get_database_url_and_connect_args()

    # Alembic uses synchronous engines; strip async driver prefixes.
    database_url = to_sync_sqlalchemy_url(database_url)

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
        with engine.begin() as connection:
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
            connection.execute(
                text("UPDATE alembic_version SET version_num = :revision"),
                {"revision": target},
            )
    finally:
        engine.dispose()


def _infer_revision_from_schema(
    inspector,
    tables: set[str],
    _head_revision: str,
) -> str:
    """Best-effort: map existing SQLite/Postgres schema to our linear migration chain."""
    owned_tables = {
        "presentations",
        "slides",
        "presentation_layout_codes",
        "templates",
        "async_tasks",
        "async_presentation_generation_tasks",
        "chat_history_messages",
        "imageasset",
        "template_create_infos",
        "template_v2",
        "webhook_subscriptions",
    }
    ownership_ready = all(
        table not in tables or _has_column(inspector, table, "owner_id")
        for table in owned_tables
    )
    if "provider_settings" in tables and "user" in tables and ownership_ready:
        return (
            REVISION_PRIMARY_ADMIN_SLOT
            if _has_column(inspector, "user", "admin_slot")
            else REVISION_USERNAME_PROVIDER_SETTINGS
        )
    if "user" in tables and ownership_ready:
        return REVISION_MULTI_USER_AUTH
    if "template_v2" in tables:
        cols = {c["name"] for c in inspector.get_columns("template_v2")}
        final_template_columns = {
            "description",
            "raw_layouts",
            "components",
            "layouts",
            "assets",
        }
        presentation_version_ready = (
            "presentations" not in tables
            or _has_presentation_version_column(inspector, tables)
        )
        slide_ui_ready = "slides" not in tables or _has_column(
            inspector, "slides", "ui"
        )
        presentation_fonts_ready = "presentations" not in tables or _has_column(
            inspector, "presentations", "fonts"
        )
        template_v2_chat_scope_ready = (
            "chat_history_messages" not in tables
            or _has_column(inspector, "chat_history_messages", "template_v2_id")
        )
        font_uploads_ready = "font_uploads" in tables
        template_v2_id_strings_ready = _has_template_v2_id_string_columns(
            inspector,
            tables,
        )
        template_v2_is_default_ready = _has_column(
            inspector, "template_v2", "is_default"
        )
        async_tasks_ready = "async_tasks" in tables
        if (
            final_template_columns.issubset(cols)
            and not {"cluster_candidates", "clusters"}.intersection(cols)
            and presentation_version_ready
        ):
            if slide_ui_ready and presentation_fonts_ready and template_v2_chat_scope_ready:
                if not font_uploads_ready:
                    return REVISION_TEMPLATE_V2_LAYOUTS_OPTIONAL
                if not template_v2_id_strings_ready:
                    return REVISION_FONT_UPLOADS
                if not template_v2_is_default_ready:
                    return REVISION_TEMPLATE_V2_ID_STRINGS
                return (
                    REVISION_ASYNC_TASKS
                    if async_tasks_ready
                    else REVISION_TEMPLATE_V2_IS_DEFAULT
                )
            if slide_ui_ready and presentation_fonts_ready:
                return REVISION_PRESENTATION_FONTS
            return REVISION_MERGED_TEMPLATE_V2 if slide_ui_ready else REVISION_TEMPLATE_V2
        return REVISION_CHAT_HISTORY
    if "async_tasks" in tables:
        return REVISION_ASYNC_TASKS
    if "chat_history_messages" in tables:
        return REVISION_CHAT_HISTORY
    if "template_create_infos" in tables:
        return REVISION_TEMPLATE_CREATE_INFO
    if "presentations" in tables:
        cols = {c["name"] for c in inspector.get_columns("presentations")}
        if "theme" in cols:
            return REVISION_BEFORE_TEMPLATE_CREATE_INFO
    return LEGACY_BASELINE_REVISION


def _has_presentation_version_column(inspector, tables: set[str]) -> bool:
    if "presentations" not in tables:
        return False

    cols = {c["name"] for c in inspector.get_columns("presentations")}
    return "version" in cols


def _has_column(inspector, table_name: str, column_name: str) -> bool:
    columns = {column["name"] for column in inspector.get_columns(table_name)}
    return column_name in columns


def _has_template_v2_id_string_columns(inspector, tables: set[str]) -> bool:
    if "template_v2" not in tables or not _has_column(inspector, "template_v2", "id"):
        return False
    if _is_uuid_storage_column(inspector, "template_v2", "id"):
        return False
    if "chat_history_messages" in tables and _has_column(
        inspector,
        "chat_history_messages",
        "template_v2_id",
    ):
        return not _is_uuid_storage_column(
            inspector,
            "chat_history_messages",
            "template_v2_id",
        )
    return True


def _is_uuid_storage_column(inspector, table_name: str, column_name: str) -> bool:
    for column in inspector.get_columns(table_name):
        if column["name"] != column_name:
            continue
        column_type = column["type"]
        type_class = column_type.__class__.__name__.lower()
        rendered_type = str(column_type).lower().replace(" ", "")
        return type_class == "uuid" or rendered_type in {"uuid", "char(32)"}
    return False


def _stamp_legacy_database_if_needed(config: Config, database_url: str) -> None:
    """
    If the DB has app tables but no migration reference in alembic_version,
    treat it as a legacy DB and stamp the latest revision already reflected by
    the live schema before upgrading.
    """
    if not _is_unversioned_populated_database(database_url):
        return

    script = ScriptDirectory.from_config(config)
    heads = script.get_heads()
    head = heads[0] if len(heads) == 1 else script.get_base()
    engine = create_engine(database_url)
    try:
        with engine.connect() as connection:
            inspector = inspect(connection)
            target_revision = _infer_revision_from_schema(
                inspector, set(inspector.get_table_names()), head
            )
    finally:
        engine.dispose()

    print(
        "Detected legacy database without migration reference. "
        f"Stamping revision to {target_revision} before upgrading.",
        flush=True,
    )
    command.stamp(config, target_revision)


def _is_unversioned_populated_database(database_url: str) -> bool:
    known_app_tables = {
        "presentations",
        "slides",
        "templates",
        "keyvaluesqlmodel",
        "imageasset",
        "presentation_layout_codes",
        "async_presentation_generation_tasks",
        "async_tasks",
        "webhook_subscriptions",
        "template_create_infos",
        "chat_history_messages",
        "template_v2",
        "font_uploads",
        "user",
        "access_tokens",
        "provider_settings",
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
