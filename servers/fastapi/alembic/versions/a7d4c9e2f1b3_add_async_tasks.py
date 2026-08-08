"""add async tasks

Revision ID: a7d4c9e2f1b3
Revises: 4b7c9d0e1f2a
Create Date: 2026-07-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "a7d4c9e2f1b3"
down_revision: Union[str, None] = "4b7c9d0e1f2a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_index(table_name: str, index_name: str) -> bool:
    indexes = sa.inspect(op.get_bind()).get_indexes(table_name)
    return index_name in {index["name"] for index in indexes}


def upgrade() -> None:
    if not _has_table("async_tasks"):
        op.create_table(
            "async_tasks",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("message", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("error", sa.JSON(), nullable=True),
            sa.Column("data", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _has_index("async_tasks", "ix_async_tasks_type"):
        op.create_index(
            op.f("ix_async_tasks_type"),
            "async_tasks",
            ["type"],
            unique=False,
        )
    if not _has_index("async_tasks", "ix_async_tasks_status"):
        op.create_index(
            op.f("ix_async_tasks_status"),
            "async_tasks",
            ["status"],
            unique=False,
        )


def downgrade() -> None:
    if _has_table("async_tasks"):
        op.drop_index(op.f("ix_async_tasks_status"), table_name="async_tasks")
        op.drop_index(op.f("ix_async_tasks_type"), table_name="async_tasks")
        op.drop_table("async_tasks")
