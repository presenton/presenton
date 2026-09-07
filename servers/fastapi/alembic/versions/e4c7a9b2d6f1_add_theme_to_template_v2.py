"""add theme to template v2

Revision ID: e4c7a9b2d6f1
Revises: d2f4a6b8c0e1
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "e4c7a9b2d6f1"
down_revision: str | None = "d2f4a6b8c0e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    return column_name in {
        column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)
    }


def upgrade() -> None:
    if not _has_table("template_v2") or _has_column("template_v2", "theme"):
        return
    op.add_column("template_v2", sa.Column("theme", sa.JSON(), nullable=True))


def downgrade() -> None:
    if _has_table("template_v2") and _has_column("template_v2", "theme"):
        op.drop_column("template_v2", "theme")
