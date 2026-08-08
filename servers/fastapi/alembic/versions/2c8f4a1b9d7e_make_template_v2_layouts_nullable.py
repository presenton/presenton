"""make template v2 layouts nullable

Revision ID: 2c8f4a1b9d7e
Revises: 1d9a4c7b8e2f
Create Date: 2026-07-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2c8f4a1b9d7e"
down_revision: Union[str, None] = "1d9a4c7b8e2f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    columns = sa.inspect(op.get_bind()).get_columns(table_name)
    return column_name in {column["name"] for column in columns}


def upgrade() -> None:
    if not _has_table("template_v2") or not _has_column("template_v2", "layouts"):
        return

    with op.batch_alter_table("template_v2") as batch_op:
        batch_op.alter_column(
            "layouts",
            existing_type=sa.JSON(),
            nullable=True,
        )


def downgrade() -> None:
    if not _has_table("template_v2") or not _has_column("template_v2", "layouts"):
        return

    op.execute(
        "UPDATE template_v2 "
        "SET layouts = '{\"layouts\": []}' "
        "WHERE layouts IS NULL"
    )
    with op.batch_alter_table("template_v2") as batch_op:
        batch_op.alter_column(
            "layouts",
            existing_type=sa.JSON(),
            nullable=False,
        )
