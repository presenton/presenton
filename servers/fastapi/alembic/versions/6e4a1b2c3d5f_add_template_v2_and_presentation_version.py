"""add template v2 and presentation version

Revision ID: 6e4a1b2c3d5f
Revises: c7b70d0f31b1
Create Date: 2026-06-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "6e4a1b2c3d5f"
down_revision: Union[str, None] = "c7b70d0f31b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PRESENTATION_VERSION_DEFAULT = "v1-standard"


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    columns = sa.inspect(op.get_bind()).get_columns(table_name)
    return column_name in {column["name"] for column in columns}


def _presentation_version_enum() -> sa.Enum:
    return sa.Enum(
        "v1-standard",
        "v2-standard",
        name="presentation_version",
        native_enum=False,
        create_constraint=True,
    )


def _upgrade_template_v2() -> None:
    if not _has_table("template_v2"):
        op.create_table(
            "template_v2",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("description", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("raw_layouts", sa.JSON(), nullable=True),
            sa.Column("components", sa.JSON(), nullable=True),
            sa.Column("layouts", sa.JSON(), nullable=False),
            sa.Column("assets", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        return

    optional_columns = (
        ("description", sqlmodel.sql.sqltypes.AutoString()),
        ("raw_layouts", sa.JSON()),
        ("components", sa.JSON()),
        ("assets", sa.JSON()),
    )
    for column_name, column_type in optional_columns:
        if not _has_column("template_v2", column_name):
            op.add_column(
                "template_v2",
                sa.Column(column_name, column_type, nullable=True),
            )

    for obsolete_column in ("cluster_candidates", "clusters"):
        if _has_column("template_v2", obsolete_column):
            op.drop_column("template_v2", obsolete_column)


def _upgrade_presentation_version() -> None:
    if not _has_table("presentations"):
        return

    version_type = _presentation_version_enum()
    if not _has_column("presentations", "version"):
        op.add_column(
            "presentations",
            sa.Column("version", version_type, nullable=True),
        )

    op.execute(
        "UPDATE presentations "
        f"SET version = '{PRESENTATION_VERSION_DEFAULT}' "
        "WHERE version IS NULL"
    )
    with op.batch_alter_table("presentations") as batch_op:
        batch_op.alter_column(
            "version",
            existing_type=version_type,
            nullable=False,
        )


def upgrade() -> None:
    _upgrade_template_v2()
    _upgrade_presentation_version()


def downgrade() -> None:
    if _has_table("presentations") and _has_column("presentations", "version"):
        op.drop_column("presentations", "version")
    if _has_table("template_v2"):
        op.drop_table("template_v2")
