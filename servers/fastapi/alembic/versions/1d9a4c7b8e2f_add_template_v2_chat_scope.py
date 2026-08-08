"""add template v2 chat scope

Revision ID: 1d9a4c7b8e2f
Revises: 9b2d1c4e5f6a
Create Date: 2026-06-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "1d9a4c7b8e2f"
down_revision: Union[str, None] = "9b2d1c4e5f6a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    columns = sa.inspect(op.get_bind()).get_columns(table_name)
    return column_name in {column["name"] for column in columns}


def _column_nullable(table_name: str, column_name: str) -> bool:
    columns = sa.inspect(op.get_bind()).get_columns(table_name)
    for column in columns:
        if column["name"] == column_name:
            return bool(column.get("nullable"))
    return True


def _has_index(table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if table_name not in inspector.get_table_names():
        return False
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def _has_foreign_key(table_name: str, constraint_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if table_name not in inspector.get_table_names():
        return False
    return constraint_name in {
        foreign_key.get("name") for foreign_key in inspector.get_foreign_keys(table_name)
    }


FK_TEMPLATE_V2_ID = "fk_chat_history_messages_template_v2_id_template_v2"


def upgrade() -> None:
    if not _has_table("chat_history_messages"):
        return

    with op.batch_alter_table("chat_history_messages") as batch_op:
        if _has_column("chat_history_messages", "presentation_id") and not _column_nullable(
            "chat_history_messages", "presentation_id"
        ):
            batch_op.alter_column(
                "presentation_id",
                existing_type=sa.Uuid(),
                nullable=True,
            )
        if not _has_column("chat_history_messages", "template_v2_id"):
            batch_op.add_column(
                sa.Column(
                    "template_v2_id",
                    sqlmodel.sql.sqltypes.AutoString(),
                    nullable=True,
                )
            )
        if not _has_foreign_key("chat_history_messages", FK_TEMPLATE_V2_ID):
            batch_op.create_foreign_key(
                FK_TEMPLATE_V2_ID,
                "template_v2",
                ["template_v2_id"],
                ["id"],
                ondelete="CASCADE",
            )

    if not _has_index(
        "chat_history_messages", op.f("ix_chat_history_messages_template_v2_id")
    ):
        op.create_index(
            op.f("ix_chat_history_messages_template_v2_id"),
            "chat_history_messages",
            ["template_v2_id"],
            unique=False,
        )


def downgrade() -> None:
    if not _has_table("chat_history_messages"):
        return

    if _has_index(
        "chat_history_messages", op.f("ix_chat_history_messages_template_v2_id")
    ):
        op.drop_index(
            op.f("ix_chat_history_messages_template_v2_id"),
            table_name="chat_history_messages",
        )

    with op.batch_alter_table("chat_history_messages") as batch_op:
        if _has_foreign_key("chat_history_messages", FK_TEMPLATE_V2_ID):
            batch_op.drop_constraint(FK_TEMPLATE_V2_ID, type_="foreignkey")
        if _has_column("chat_history_messages", "template_v2_id"):
            batch_op.drop_column("template_v2_id")
        if _has_column("chat_history_messages", "presentation_id") and _column_nullable(
            "chat_history_messages", "presentation_id"
        ):
            batch_op.alter_column(
                "presentation_id",
                existing_type=sa.Uuid(),
                nullable=False,
            )
