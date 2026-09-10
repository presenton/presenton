"""add presentations.revision and document_operations

Revision ID: f7a1c3e5b9d2
Revises: 026c0ba8b35c
Create Date: 2026-09-06

Executor receipts and CAS revision must exist on the Alembic migrate-on-startup
path. create_all only runs when MIGRATE_DATABASE_ON_STARTUP is false.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op


revision: str = "f7a1c3e5b9d2"
down_revision: str | None = "026c0ba8b35c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "presentations" in tables:
        columns = {column["name"] for column in inspector.get_columns("presentations")}
        if "revision" not in columns:
            op.add_column(
                "presentations",
                sa.Column(
                    "revision",
                    sa.Integer(),
                    nullable=False,
                    server_default=sa.text("1"),
                ),
            )
            op.execute(sa.text("UPDATE presentations SET revision = 1 WHERE revision IS NULL"))

    if "document_operations" not in tables:
        op.create_table(
            "document_operations",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("document_id", sa.Uuid(), nullable=True),
            sa.Column("operation_id", sa.Uuid(), nullable=False),
            sa.Column("idempotency_key", sa.String(length=128), nullable=False),
            sa.Column("request_hash", sa.String(length=64), nullable=False),
            sa.Column("state", sa.String(), nullable=False),
            sa.Column("actor_id", sa.Uuid(), nullable=True),
            sa.Column("actor_source", sa.String(), nullable=False),
            sa.Column("base_revision", sa.Integer(), nullable=False),
            sa.Column("resulting_revision", sa.Integer(), nullable=False),
            sa.Column("changed_slide_ids", sa.JSON(), nullable=True),
            sa.Column("receipt", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["document_id"], ["presentations.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "document_id", "operation_id", name="uq_document_operation"
            ),
            sa.UniqueConstraint(
                "document_id",
                "idempotency_key",
                name="uq_document_idempotency_key",
            ),
        )
        op.create_index(
            "ix_document_operations_document_id",
            "document_operations",
            ["document_id"],
            unique=False,
        )
        op.create_index(
            "ix_document_operations_operation_id",
            "document_operations",
            ["operation_id"],
            unique=False,
        )
        op.create_index(
            "ix_document_operations_actor_id",
            "document_operations",
            ["actor_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "document_operations" in tables:
        op.drop_index("ix_document_operations_actor_id", table_name="document_operations")
        op.drop_index(
            "ix_document_operations_operation_id", table_name="document_operations"
        )
        op.drop_index(
            "ix_document_operations_document_id", table_name="document_operations"
        )
        op.drop_table("document_operations")
    if "presentations" in tables:
        columns = {column["name"] for column in inspector.get_columns("presentations")}
        if "revision" in columns:
            op.drop_column("presentations", "revision")
