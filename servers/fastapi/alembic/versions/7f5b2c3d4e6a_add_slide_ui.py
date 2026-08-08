"""add slide ui

Revision ID: 7f5b2c3d4e6a
Revises: 6e4a1b2c3d5f
Create Date: 2026-06-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7f5b2c3d4e6a"
down_revision: Union[str, None] = "6e4a1b2c3d5f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    columns = sa.inspect(op.get_bind()).get_columns(table_name)
    return column_name in {column["name"] for column in columns}


def upgrade() -> None:
    if _has_table("slides") and not _has_column("slides", "ui"):
        op.add_column("slides", sa.Column("ui", sa.JSON(), nullable=True))


def downgrade() -> None:
    if _has_table("slides") and _has_column("slides", "ui"):
        op.drop_column("slides", "ui")
