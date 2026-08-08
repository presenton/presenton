from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text

import migrations


def _alembic_config(database_url: str) -> Config:
    config = Config()
    config.set_main_option(
        "script_location", str(Path(__file__).resolve().parents[2] / "alembic")
    )
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def test_legacy_database_with_theme_is_stamped_past_theme_migration(
    tmp_path, monkeypatch
):
    database_url = f"sqlite:///{tmp_path / 'legacy.db'}"
    engine = create_engine(database_url)
    try:
        with engine.begin() as connection:
            connection.execute(
                text("CREATE TABLE presentations (id TEXT PRIMARY KEY, theme JSON)")
            )
    finally:
        engine.dispose()

    stamped_revisions = []
    monkeypatch.setattr(
        migrations.command,
        "stamp",
        lambda _config, revision: stamped_revisions.append(revision),
    )

    migrations._stamp_legacy_database_if_needed(
        _alembic_config(database_url), database_url
    )

    assert stamped_revisions == [migrations.REVISION_BEFORE_TEMPLATE_CREATE_INFO]


def test_upgrade_from_baseline_stamp_skips_existing_theme_column(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'baseline-stamped.db'}"
    engine = create_engine(database_url)
    try:
        with engine.begin() as connection:
            connection.execute(
                text("CREATE TABLE presentations (id TEXT PRIMARY KEY, theme JSON)")
            )
            connection.execute(
                text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
            )
            connection.execute(
                text("INSERT INTO alembic_version (version_num) VALUES (:revision)"),
                {"revision": migrations.LEGACY_BASELINE_REVISION},
            )

        command.upgrade(_alembic_config(database_url), "head")

        with engine.connect() as connection:
            version = connection.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one()
            columns = {
                row[1]
                for row in connection.execute(text("PRAGMA table_info(presentations)"))
            }
            tables = {
                row[0]
                for row in connection.execute(
                    text("SELECT name FROM sqlite_master WHERE type = 'table'")
                )
            }
            user_columns = {
                row[1]
                for row in connection.execute(text("PRAGMA table_info('user')"))
            }
            user_indexes = {
                row[1]
                for row in connection.execute(text("PRAGMA index_list('user')"))
            }

        assert version == migrations.REVISION_PRIMARY_ADMIN_SLOT
        assert "theme" in columns
        assert "fonts" in columns
        assert "async_tasks" in tables
        assert "admin_slot" in user_columns
        assert "uq_user_admin_slot" in user_indexes
    finally:
        engine.dispose()


def test_upgrade_from_theme_stamp_skips_existing_template_create_infos_table(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'template-table-exists.db'}"
    engine = create_engine(database_url)
    try:
        with engine.begin() as connection:
            connection.execute(
                text("CREATE TABLE presentations (id TEXT PRIMARY KEY, theme JSON)")
            )
            connection.execute(
                text(
                    """
                    CREATE TABLE template_create_infos (
                        id CHAR(32) NOT NULL,
                        fonts JSON,
                        pptx_url VARCHAR,
                        slide_htmls JSON NOT NULL,
                        slide_image_urls JSON NOT NULL,
                        created_at DATETIME NOT NULL,
                        PRIMARY KEY (id)
                    )
                    """
                )
            )
            connection.execute(
                text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
            )
            connection.execute(
                text("INSERT INTO alembic_version (version_num) VALUES (:revision)"),
                {"revision": migrations.REVISION_BEFORE_TEMPLATE_CREATE_INFO},
            )

        command.upgrade(_alembic_config(database_url), "head")

        with engine.connect() as connection:
            version = connection.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one()
            tables = {
                row[0]
                for row in connection.execute(
                    text("SELECT name FROM sqlite_master WHERE type = 'table'")
                )
            }

        assert version == migrations.REVISION_PRIMARY_ADMIN_SLOT
        assert "template_create_infos" in tables
    finally:
        engine.dispose()


def test_upgrade_from_template_stamp_skips_existing_chat_history_table(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'chat-table-exists.db'}"
    engine = create_engine(database_url)
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE presentations (id TEXT PRIMARY KEY)"))
            connection.execute(
                text(
                    """
                    CREATE TABLE chat_history_messages (
                        id CHAR(32) NOT NULL,
                        presentation_id CHAR(32) NOT NULL,
                        conversation_id CHAR(32) NOT NULL,
                        position INTEGER NOT NULL,
                        role VARCHAR NOT NULL,
                        content TEXT NOT NULL,
                        created_at DATETIME NOT NULL,
                        tool_calls JSON,
                        PRIMARY KEY (id)
                    )
                    """
                )
            )
            connection.execute(
                text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
            )
            connection.execute(
                text("INSERT INTO alembic_version (version_num) VALUES (:revision)"),
                {"revision": migrations.REVISION_TEMPLATE_CREATE_INFO},
            )

        command.upgrade(_alembic_config(database_url), "head")

        with engine.connect() as connection:
            version = connection.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one()
            indexes = {
                row[1]
                for row in connection.execute(
                    text("PRAGMA index_list(chat_history_messages)")
                )
            }
            tables = {
                row[0]
                for row in connection.execute(
                    text("SELECT name FROM sqlite_master WHERE type = 'table'")
                )
            }
            template_columns = {
                row[1]
                for row in connection.execute(text("PRAGMA table_info(template_v2)"))
            }

        assert version == migrations.REVISION_PRIMARY_ADMIN_SLOT
        assert {
            "ix_chat_history_messages_conversation_id",
            "ix_chat_history_messages_position",
            "ix_chat_history_messages_presentation_id",
            "ix_chat_history_messages_template_v2_id",
        }.issubset(indexes)
        assert "template_v2" in tables
        assert "components" in template_columns
        assert "cluster_candidates" not in template_columns
        assert "clusters" not in template_columns
    finally:
        engine.dispose()


def test_consolidated_migration_adds_presentation_version(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'presentation-version.db'}"
    engine = create_engine(database_url)
    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    CREATE TABLE presentations (
                        id TEXT PRIMARY KEY,
                        content VARCHAR NOT NULL,
                        n_slides INTEGER NOT NULL,
                        language VARCHAR NOT NULL
                    )
                    """
                )
            )
            connection.execute(
                text(
                    """
                    INSERT INTO presentations (id, content, n_slides, language)
                    VALUES ('p1', 'content', 1, 'English')
                    """
                )
            )
            connection.execute(text("CREATE TABLE slides (id TEXT PRIMARY KEY)"))
            connection.execute(
                text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
            )
            connection.execute(
                text("INSERT INTO alembic_version (version_num) VALUES (:revision)"),
                {"revision": migrations.REVISION_CHAT_HISTORY},
            )

        command.upgrade(_alembic_config(database_url), "head")

        with engine.connect() as connection:
            version = connection.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one()
            presentation_version = connection.execute(
                text("SELECT version FROM presentations WHERE id = 'p1'")
            ).scalar_one()
            version_column = next(
                row
                for row in connection.execute(text("PRAGMA table_info(presentations)"))
                if row[1] == "version"
            )
            slide_columns = {
                row[1]
                for row in connection.execute(text("PRAGMA table_info(slides)"))
            }

        assert version == migrations.REVISION_PRIMARY_ADMIN_SLOT
        assert presentation_version == "v1-standard"
        assert version_column[3] == 1
        assert version_column[4] is None
        assert "ui" in slide_columns
    finally:
        engine.dispose()


def test_async_task_status_migration_maps_processing_to_pending(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'async-task-status.db'}"
    engine = create_engine(database_url)
    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    CREATE TABLE async_tasks (
                        id VARCHAR NOT NULL,
                        type VARCHAR NOT NULL,
                        status VARCHAR NOT NULL,
                        PRIMARY KEY (id)
                    )
                    """
                )
            )
            connection.execute(
                text(
                    """
                    INSERT INTO async_tasks (id, type, status)
                    VALUES
                        ('task-processing', 'template.create', 'processing'),
                        ('task-pending', 'template.create', 'pending'),
                        ('task-completed', 'template.create', 'completed')
                    """
                )
            )
            connection.execute(
                text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
            )
            connection.execute(
                text("INSERT INTO alembic_version (version_num) VALUES (:revision)"),
                {"revision": migrations.REVISION_ASYNC_TASKS},
            )

        command.upgrade(_alembic_config(database_url), "head")

        with engine.connect() as connection:
            version = connection.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one()
            statuses = dict(
                connection.execute(
                    text("SELECT id, status FROM async_tasks ORDER BY id")
                ).all()
            )

        assert version == migrations.REVISION_PRIMARY_ADMIN_SLOT
        assert statuses == {
            "task-completed": "completed",
            "task-pending": "pending",
            "task-processing": "pending",
        }
    finally:
        engine.dispose()


def test_unversioned_database_with_async_tasks_stamps_before_status_cleanup(
    tmp_path, monkeypatch
):
    database_url = f"sqlite:///{tmp_path / 'legacy-async-tasks.db'}"
    engine = create_engine(database_url)
    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    CREATE TABLE async_tasks (
                        id VARCHAR NOT NULL,
                        type VARCHAR NOT NULL,
                        status VARCHAR NOT NULL,
                        PRIMARY KEY (id)
                    )
                    """
                )
            )
    finally:
        engine.dispose()

    stamped_revisions = []
    monkeypatch.setattr(
        migrations.command,
        "stamp",
        lambda _config, revision: stamped_revisions.append(revision),
    )

    migrations._stamp_legacy_database_if_needed(
        _alembic_config(database_url), database_url
    )

    assert stamped_revisions == [migrations.REVISION_ASYNC_TASKS]


def test_unversioned_database_with_chat_history_stamps_before_template_v2(
    tmp_path, monkeypatch
):
    database_url = f"sqlite:///{tmp_path / 'legacy-chat.db'}"
    engine = create_engine(database_url)
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE presentations (id TEXT PRIMARY KEY)"))
            connection.execute(
                text(
                    """
                    CREATE TABLE chat_history_messages (
                        id CHAR(32) NOT NULL,
                        presentation_id CHAR(32) NOT NULL,
                        conversation_id CHAR(32) NOT NULL,
                        position INTEGER NOT NULL,
                        role VARCHAR NOT NULL,
                        content TEXT NOT NULL,
                        created_at DATETIME NOT NULL,
                        PRIMARY KEY (id)
                    )
                    """
                )
            )
    finally:
        engine.dispose()

    stamped_revisions = []
    monkeypatch.setattr(
        migrations.command,
        "stamp",
        lambda _config, revision: stamped_revisions.append(revision),
    )

    migrations._stamp_legacy_database_if_needed(
        _alembic_config(database_url), database_url
    )

    assert stamped_revisions == [migrations.REVISION_CHAT_HISTORY]


def test_upgrade_from_template_v2_revision_adds_slide_ui(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'slide-ui.db'}"
    engine = create_engine(database_url)
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE slides (id TEXT PRIMARY KEY)"))
            connection.execute(
                text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
            )
            connection.execute(
                text("INSERT INTO alembic_version (version_num) VALUES (:revision)"),
                {"revision": migrations.REVISION_TEMPLATE_V2},
            )

        command.upgrade(_alembic_config(database_url), "head")

        with engine.connect() as connection:
            version = connection.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one()
            slide_columns = {
                row[1]
                for row in connection.execute(text("PRAGMA table_info(slides)"))
            }

        assert version == migrations.REVISION_PRIMARY_ADMIN_SLOT
        assert "ui" in slide_columns
    finally:
        engine.dispose()


def test_upgrade_from_font_uploads_revision_converts_template_v2_ids_to_strings(
    tmp_path,
):
    database_url = f"sqlite:///{tmp_path / 'template-v2-string-ids.db'}"
    template_id = "12345678123456781234567812345678"
    expected_template_id = "12345678-1234-5678-1234-567812345678"
    engine = create_engine(database_url)
    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    CREATE TABLE template_v2 (
                        id CHAR(32) NOT NULL,
                        name VARCHAR NOT NULL,
                        description VARCHAR,
                        raw_layouts JSON,
                        components JSON,
                        merged_components JSON,
                        layouts JSON,
                        assets JSON,
                        created_at DATETIME NOT NULL,
                        updated_at DATETIME NOT NULL,
                        PRIMARY KEY (id)
                    )
                    """
                )
            )
            connection.execute(
                text(
                    """
                    INSERT INTO template_v2 (
                        id, name, layouts, created_at, updated_at
                    )
                    VALUES (
                        :template_id,
                        'Legacy V2',
                        '{"layouts": []}',
                        '2026-07-09 00:00:00',
                        '2026-07-09 00:00:00'
                    )
                    """
                ),
                {"template_id": template_id},
            )
            connection.execute(
                text(
                    """
                    CREATE TABLE chat_history_messages (
                        id CHAR(32) NOT NULL,
                        presentation_id CHAR(32),
                        template_v2_id CHAR(32),
                        conversation_id CHAR(32) NOT NULL,
                        position INTEGER NOT NULL,
                        role VARCHAR NOT NULL,
                        content TEXT NOT NULL,
                        created_at DATETIME NOT NULL,
                        tool_calls JSON,
                        PRIMARY KEY (id)
                    )
                    """
                )
            )
            connection.execute(
                text(
                    """
                    INSERT INTO chat_history_messages (
                        id,
                        template_v2_id,
                        conversation_id,
                        position,
                        role,
                        content,
                        created_at
                    )
                    VALUES (
                        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                        :template_id,
                        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                        1,
                        'user',
                        'hello',
                        '2026-07-09 00:00:00'
                    )
                    """
                ),
                {"template_id": template_id},
            )
            connection.execute(
                text(
                    """
                    CREATE INDEX ix_chat_history_messages_template_v2_id
                    ON chat_history_messages (template_v2_id)
                    """
                )
            )
            connection.execute(
                text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
            )
            connection.execute(
                text("INSERT INTO alembic_version (version_num) VALUES (:revision)"),
                {"revision": migrations.REVISION_FONT_UPLOADS},
            )

        command.upgrade(_alembic_config(database_url), "head")

        with engine.connect() as connection:
            version = connection.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one()
            stored_template_id = connection.execute(
                text("SELECT id FROM template_v2")
            ).scalar_one()
            stored_chat_template_id = connection.execute(
                text("SELECT template_v2_id FROM chat_history_messages")
            ).scalar_one()
            template_id_type = next(
                row[2]
                for row in connection.execute(text("PRAGMA table_info(template_v2)"))
                if row[1] == "id"
            )
            chat_template_id_type = next(
                row[2]
                for row in connection.execute(
                    text("PRAGMA table_info(chat_history_messages)")
                )
                if row[1] == "template_v2_id"
            )
            template_columns = {
                row[1]
                for row in connection.execute(text("PRAGMA table_info(template_v2)"))
            }

        assert version == migrations.REVISION_PRIMARY_ADMIN_SLOT
        assert stored_template_id == expected_template_id
        assert stored_chat_template_id == expected_template_id
        assert template_id_type == "VARCHAR"
        assert chat_template_id_type == "VARCHAR"
        assert "is_default" in template_columns
    finally:
        engine.dispose()


def test_unversioned_database_with_old_template_v2_stamps_before_consolidated(
    tmp_path, monkeypatch
):
    database_url = f"sqlite:///{tmp_path / 'legacy-template-v2.db'}"
    engine = create_engine(database_url)
    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    CREATE TABLE template_v2 (
                        id CHAR(32) NOT NULL,
                        name VARCHAR NOT NULL,
                        raw_layouts JSON,
                        layouts JSON NOT NULL,
                        created_at DATETIME NOT NULL,
                        updated_at DATETIME NOT NULL,
                        PRIMARY KEY (id)
                    )
                    """
                )
            )
    finally:
        engine.dispose()

    stamped_revisions = []
    monkeypatch.setattr(
        migrations.command,
        "stamp",
        lambda _config, revision: stamped_revisions.append(revision),
    )

    migrations._stamp_legacy_database_if_needed(
        _alembic_config(database_url), database_url
    )

    assert stamped_revisions == [migrations.REVISION_CHAT_HISTORY]


def test_unversioned_database_with_template_v2_artifacts_stamps_before_consolidated(
    tmp_path, monkeypatch
):
    database_url = f"sqlite:///{tmp_path / 'legacy-template-v2-artifacts.db'}"
    engine = create_engine(database_url)
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE presentations (id TEXT PRIMARY KEY)"))
            connection.execute(
                text(
                    """
                    CREATE TABLE template_v2 (
                        id CHAR(32) NOT NULL,
                        name VARCHAR NOT NULL,
                        raw_layouts JSON,
                        layouts JSON NOT NULL,
                        cluster_candidates JSON,
                        clusters JSON,
                        components JSON,
                        created_at DATETIME NOT NULL,
                        updated_at DATETIME NOT NULL,
                        PRIMARY KEY (id)
                    )
                    """
                )
            )
    finally:
        engine.dispose()

    stamped_revisions = []
    monkeypatch.setattr(
        migrations.command,
        "stamp",
        lambda _config, revision: stamped_revisions.append(revision),
    )

    migrations._stamp_legacy_database_if_needed(
        _alembic_config(database_url), database_url
    )

    assert stamped_revisions == [migrations.REVISION_CHAT_HISTORY]


def test_removed_intermediate_revision_upgrades_through_consolidated_migration(
    tmp_path,
):
    database_url = f"sqlite:///{tmp_path / 'removed-template-v2-revision.db'}"
    engine = create_engine(database_url)
    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    CREATE TABLE presentations (
                        id TEXT PRIMARY KEY,
                        version VARCHAR NOT NULL
                    )
                    """
                )
            )
            connection.execute(
                text(
                    """
                    CREATE TABLE template_v2 (
                        id CHAR(32) NOT NULL,
                        name VARCHAR NOT NULL,
                        raw_layouts JSON,
                        layouts JSON NOT NULL,
                        cluster_candidates JSON,
                        clusters JSON,
                        components JSON,
                        created_at DATETIME NOT NULL,
                        updated_at DATETIME NOT NULL,
                        PRIMARY KEY (id)
                    )
                    """
                )
            )
            connection.execute(
                text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
            )
            connection.execute(
                text("INSERT INTO alembic_version (version_num) VALUES ('2d7c8f9a0b1c')")
            )

        config = _alembic_config(database_url)
        migrations._repair_orphan_alembic_revision(config, database_url)
        command.upgrade(config, "head")

        with engine.connect() as connection:
            version = connection.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one()
            template_columns = {
                row[1]
                for row in connection.execute(text("PRAGMA table_info(template_v2)"))
            }

        assert version == migrations.REVISION_PRIMARY_ADMIN_SLOT
        assert {"description", "components", "assets"}.issubset(template_columns)
        assert "is_default" in template_columns
        assert "cluster_candidates" not in template_columns
        assert "clusters" not in template_columns
    finally:
        engine.dispose()
