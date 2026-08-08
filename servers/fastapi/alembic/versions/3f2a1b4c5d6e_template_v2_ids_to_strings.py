"""change template v2 ids to strings

Revision ID: 3f2a1b4c5d6e
Revises: 5d7e9a1b2c3f
Create Date: 2026-07-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "3f2a1b4c5d6e"
down_revision: Union[str, None] = "5d7e9a1b2c3f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


FK_TEMPLATE_V2_ID = "fk_chat_history_messages_template_v2_id_template_v2"
TEMPLATE_V2_INDEX_NAME = "ix_chat_history_messages_template_v2_id"


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    columns = _inspector().get_columns(table_name)
    return column_name in {column["name"] for column in columns}


def _column_type(table_name: str, column_name: str) -> sa.types.TypeEngine:
    for column in _inspector().get_columns(table_name):
        if column["name"] == column_name:
            return column["type"]
    return sa.Uuid()


def _has_index(table_name: str, index_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return index_name in {index["name"] for index in _inspector().get_indexes(table_name)}


def _has_foreign_key(table_name: str, constraint_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return constraint_name in {
        foreign_key.get("name") for foreign_key in _inspector().get_foreign_keys(table_name)
    }


def _batch_kwargs() -> dict[str, str]:
    if op.get_bind().dialect.name == "sqlite":
        return {"recreate": "always"}
    return {}


def _drop_template_v2_chat_scope() -> None:
    if not _has_table("chat_history_messages"):
        return

    if _has_index("chat_history_messages", TEMPLATE_V2_INDEX_NAME):
        op.drop_index(TEMPLATE_V2_INDEX_NAME, table_name="chat_history_messages")

    if _has_foreign_key("chat_history_messages", FK_TEMPLATE_V2_ID):
        with op.batch_alter_table("chat_history_messages", **_batch_kwargs()) as batch_op:
            batch_op.drop_constraint(FK_TEMPLATE_V2_ID, type_="foreignkey")


def _restore_template_v2_chat_scope() -> None:
    if not (
        _has_table("chat_history_messages")
        and _has_column("chat_history_messages", "template_v2_id")
        and _has_table("template_v2")
    ):
        return

    if not _has_foreign_key("chat_history_messages", FK_TEMPLATE_V2_ID):
        with op.batch_alter_table("chat_history_messages", **_batch_kwargs()) as batch_op:
            batch_op.create_foreign_key(
                FK_TEMPLATE_V2_ID,
                "template_v2",
                ["template_v2_id"],
                ["id"],
                ondelete="CASCADE",
            )

    if not _has_index("chat_history_messages", TEMPLATE_V2_INDEX_NAME):
        op.create_index(
            TEMPLATE_V2_INDEX_NAME,
            "chat_history_messages",
            ["template_v2_id"],
            unique=False,
        )


def _normalize_sqlite_uuid_strings(table_name: str, column_name: str) -> None:
    if op.get_bind().dialect.name != "sqlite":
        return
    if not (_has_table(table_name) and _has_column(table_name, column_name)):
        return

    op.execute(
        sa.text(
            f"""
            UPDATE {table_name}
            SET {column_name} = lower(
                substr({column_name}, 1, 8) || '-' ||
                substr({column_name}, 9, 4) || '-' ||
                substr({column_name}, 13, 4) || '-' ||
                substr({column_name}, 17, 4) || '-' ||
                substr({column_name}, 21)
            )
            WHERE {column_name} IS NOT NULL
              AND length({column_name}) = 32
              AND {column_name} NOT LIKE '%-%'
            """
        )
    )


def _denormalize_sqlite_uuid_strings(table_name: str, column_name: str) -> None:
    if op.get_bind().dialect.name != "sqlite":
        return
    if not (_has_table(table_name) and _has_column(table_name, column_name)):
        return

    op.execute(
        sa.text(
            f"""
            UPDATE {table_name}
            SET {column_name} = lower(replace({column_name}, '-', ''))
            WHERE {column_name} IS NOT NULL
              AND length({column_name}) = 36
            """
        )
    )


def _alter_column_to_string(table_name: str, column_name: str, *, nullable: bool) -> None:
    if not (_has_table(table_name) and _has_column(table_name, column_name)):
        return

    with op.batch_alter_table(table_name, **_batch_kwargs()) as batch_op:
        batch_op.alter_column(
            column_name,
            existing_type=_column_type(table_name, column_name),
            type_=sqlmodel.sql.sqltypes.AutoString(),
            nullable=nullable,
            postgresql_using=f"{column_name}::text",
        )


def _alter_column_to_uuid(table_name: str, column_name: str, *, nullable: bool) -> None:
    if not (_has_table(table_name) and _has_column(table_name, column_name)):
        return

    with op.batch_alter_table(table_name, **_batch_kwargs()) as batch_op:
        batch_op.alter_column(
            column_name,
            existing_type=_column_type(table_name, column_name),
            type_=sa.Uuid(),
            nullable=nullable,
            postgresql_using=f"{column_name}::uuid",
        )


def upgrade() -> None:
    if not _has_table("template_v2"):
        return

    _drop_template_v2_chat_scope()
    _alter_column_to_string("template_v2", "id", nullable=False)
    _alter_column_to_string("chat_history_messages", "template_v2_id", nullable=True)
    _normalize_sqlite_uuid_strings("template_v2", "id")
    _normalize_sqlite_uuid_strings("chat_history_messages", "template_v2_id")
    _restore_template_v2_chat_scope()


def downgrade() -> None:
    if not _has_table("template_v2"):
        return

    _drop_template_v2_chat_scope()
    _denormalize_sqlite_uuid_strings("chat_history_messages", "template_v2_id")
    _denormalize_sqlite_uuid_strings("template_v2", "id")
    _alter_column_to_uuid("chat_history_messages", "template_v2_id", nullable=True)
    _alter_column_to_uuid("template_v2", "id", nullable=False)
    _restore_template_v2_chat_scope()
