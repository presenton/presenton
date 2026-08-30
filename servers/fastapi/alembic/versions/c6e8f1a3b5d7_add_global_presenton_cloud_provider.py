"""add global Presenton Cloud provider

Revision ID: c6e8f1a3b5d7
Revises: f3a7c1d9e5b2
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c6e8f1a3b5d7"
down_revision: str | None = "f3a7c1d9e5b2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "presenton_cloud_provider" in inspector.get_table_names():
        return
    op.create_table(
        "presenton_cloud_provider",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("issuer", sa.String(length=512), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("access_token_encrypted", sa.Text(), nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "presenton_cloud_provider" in inspector.get_table_names():
        op.drop_table("presenton_cloud_provider")
