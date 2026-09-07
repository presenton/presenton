"""add merged components to template v2

Revision ID: 8a6c4d2e1f30
Revises: 7f5b2c3d4e6a
Create Date: 2026-06-22 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8a6c4d2e1f30"
down_revision: str | None = "7f5b2c3d4e6a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    columns = sa.inspect(op.get_bind()).get_columns(table_name)
    return column_name in {column["name"] for column in columns}


def upgrade() -> None:
    if _has_table("template_v2") and not _has_column("template_v2", "merged_components"):
        op.add_column(
            "template_v2",
            sa.Column("merged_components", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    if _has_table("template_v2") and _has_column("template_v2", "merged_components"):
        op.drop_column("template_v2", "merged_components")
