"""add is_default to template v2

Revision ID: 4b7c9d0e1f2a
Revises: 3f2a1b4c5d6e
Create Date: 2026-07-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4b7c9d0e1f2a"
down_revision: Union[str, None] = "3f2a1b4c5d6e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    columns = sa.inspect(op.get_bind()).get_columns(table_name)
    return column_name in {column["name"] for column in columns}


def upgrade() -> None:
    if not _has_table("template_v2") or _has_column("template_v2", "is_default"):
        return

    op.add_column(
        "template_v2",
        sa.Column(
            "is_default",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    if _has_table("template_v2") and _has_column("template_v2", "is_default"):
        op.drop_column("template_v2", "is_default")
