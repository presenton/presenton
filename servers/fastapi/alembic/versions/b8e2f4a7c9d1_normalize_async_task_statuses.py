"""normalize async task statuses

Revision ID: b8e2f4a7c9d1
Revises: a7d4c9e2f1b3
Create Date: 2026-07-20 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b8e2f4a7c9d1"
down_revision: str | None = "a7d4c9e2f1b3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    if _has_table("async_tasks"):
        op.execute(
            sa.text(
                """
                UPDATE async_tasks
                SET status = 'pending'
                WHERE status = 'processing'
                """
            )
        )


def downgrade() -> None:
    pass
