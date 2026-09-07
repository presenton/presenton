"""username-only accounts and database-backed provider settings

Revision ID: d0a2b4c6e8f1
Revises: c9f1a2b3d4e5
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d0a2b4c6e8f1"
down_revision: str | None = "c9f1a2b3d4e5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "provider_settings" not in tables:
        op.create_table(
            "provider_settings",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("config", sa.JSON(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )

    if "user" in tables:
        columns = {column["name"] for column in inspector.get_columns("user")}
        if "email" in columns:
            indexes = {index["name"] for index in inspector.get_indexes("user")}
            with op.batch_alter_table("user") as batch:
                if "ix_user_email" in indexes:
                    batch.drop_index("ix_user_email")
                batch.drop_column("email")


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    if "provider_settings" in tables:
        op.drop_table("provider_settings")
