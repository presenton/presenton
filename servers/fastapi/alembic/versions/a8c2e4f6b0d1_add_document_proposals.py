"""add document_proposals

Revision ID: a8c2e4f6b0d1
Revises: f7a1c3e5b9d2
Create Date: 2026-09-07
"""
from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op

revision: str = "a8c2e4f6b0d1"
down_revision: str | None = "f7a1c3e5b9d2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "document_proposals" not in tables:
        op.create_table(
            "document_proposals",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("document_id", sa.Uuid(), nullable=True),
            sa.Column("base_revision", sa.Integer(), nullable=False),
            sa.Column("operations", sa.JSON(), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("payload_hash", sa.String(length=64), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["document_id"], ["presentations.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_document_proposals_document_id", "document_proposals", ["document_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "document_proposals" in set(inspector.get_table_names()):
        op.drop_index("ix_document_proposals_document_id", table_name="document_proposals")
        op.drop_table("document_proposals")
