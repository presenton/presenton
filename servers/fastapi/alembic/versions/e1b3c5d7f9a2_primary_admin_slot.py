"""enforce one primary administrator

Revision ID: e1b3c5d7f9a2
Revises: d0a2b4c6e8f1
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "e1b3c5d7f9a2"
down_revision: str | None = "d0a2b4c6e8f1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("user")}
    if "admin_slot" not in columns:
        with op.batch_alter_table("user") as batch:
            batch.add_column(sa.Column("admin_slot", sa.String(length=32), nullable=True))

    user_table = sa.table(
        "user",
        sa.column("id", sa.Uuid()),
        sa.column("is_superuser", sa.Boolean()),
        sa.column("admin_slot", sa.String(length=32)),
    )
    primary_admin_id = bind.execute(
        sa.select(user_table.c.id)
        .where(user_table.c.is_superuser.is_(True))
        .limit(1)
    ).scalar_one_or_none()
    if primary_admin_id is not None:
        bind.execute(
            sa.update(user_table)
            .where(user_table.c.id == primary_admin_id)
            .values(admin_slot="primary")
        )

    indexes = {index["name"] for index in sa.inspect(bind).get_indexes("user")}
    if "uq_user_admin_slot" not in indexes:
        op.create_index(
            "uq_user_admin_slot",
            "user",
            ["admin_slot"],
            unique=True,
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "user" not in inspector.get_table_names():
        return
    indexes = {index["name"] for index in inspector.get_indexes("user")}
    if "uq_user_admin_slot" in indexes:
        op.drop_index("uq_user_admin_slot", table_name="user")
    columns = {column["name"] for column in inspector.get_columns("user")}
    if "admin_slot" in columns:
        with op.batch_alter_table("user") as batch:
            batch.drop_column("admin_slot")
