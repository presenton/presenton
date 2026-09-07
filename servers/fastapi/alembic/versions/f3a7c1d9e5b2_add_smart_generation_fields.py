"""add smart presentation generation fields

Revision ID: f3a7c1d9e5b2
Revises: e1b3c5d7f9a2
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f3a7c1d9e5b2"
down_revision: str | None = "e1b3c5d7f9a2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "presentations" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("presentations")}
    with op.batch_alter_table("presentations") as batch_op:
        if "generation_mode" not in columns:
            batch_op.add_column(
                sa.Column(
                    "generation_mode",
                    sa.String(),
                    nullable=False,
                    server_default="standard",
                )
            )
        if "community_design_ids" not in columns:
            batch_op.add_column(sa.Column("community_design_ids", sa.JSON(), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "presentations" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("presentations")}
    with op.batch_alter_table("presentations") as batch_op:
        if "community_design_ids" in columns:
            batch_op.drop_column("community_design_ids")
        if "generation_mode" in columns:
            batch_op.drop_column("generation_mode")
