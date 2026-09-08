"""add document_jobs outbox

Revision ID: b1d3e5f7a9c0
Revises: a8c2e4f6b0d1
Create Date: 2026-09-08
"""
from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op

revision: str = "b1d3e5f7a9c0"
down_revision: str | None = "a8c2e4f6b0d1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "document_jobs" not in set(inspector.get_table_names()):
        op.create_table(
            "document_jobs",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("document_id", sa.Uuid(), nullable=True),
            sa.Column("kind", sa.String(length=64), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("payload", sa.JSON(), nullable=True),
            sa.Column("lease_owner", sa.String(length=128), nullable=True),
            sa.Column("lease_until", sa.DateTime(timezone=True), nullable=True),
            sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["document_id"], ["presentations.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_document_jobs_document_id", "document_jobs", ["document_id"])
        op.create_index("ix_document_jobs_status", "document_jobs", ["status"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "document_jobs" in set(inspector.get_table_names()):
        op.drop_index("ix_document_jobs_status", table_name="document_jobs")
        op.drop_index("ix_document_jobs_document_id", table_name="document_jobs")
        op.drop_table("document_jobs")
