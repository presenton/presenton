"""add fonts column to presentations

Revision ID: 9b2d1c4e5f6a
Revises: 8a6c4d2e1f30
Create Date: 2026-06-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9b2d1c4e5f6a"
down_revision: Union[str, None] = "8a6c4d2e1f30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    columns = sa.inspect(op.get_bind()).get_columns(table_name)
    return column_name in {column["name"] for column in columns}


def upgrade() -> None:
    if _has_table("presentations") and not _has_column("presentations", "fonts"):
        op.add_column(
            "presentations",
            sa.Column("fonts", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    if _has_table("presentations") and _has_column("presentations", "fonts"):
        op.drop_column("presentations", "fonts")
