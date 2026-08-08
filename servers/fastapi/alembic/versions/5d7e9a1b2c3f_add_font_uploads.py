"""add font uploads

Revision ID: 5d7e9a1b2c3f
Revises: 2c8f4a1b9d7e
Create Date: 2026-07-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "5d7e9a1b2c3f"
down_revision: Union[str, None] = "2c8f4a1b9d7e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_index(table_name: str, index_name: str) -> bool:
    indexes = sa.inspect(op.get_bind()).get_indexes(table_name)
    return index_name in {index["name"] for index in indexes}


def upgrade() -> None:
    if not _has_table("font_uploads"):
        op.create_table(
            "font_uploads",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("filename", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("path", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column(
                "normalized_family_name",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=False,
            ),
            sa.Column("family_name", sa.String(), nullable=True),
            sa.Column("subfamily_name", sa.String(), nullable=True),
            sa.Column("full_name", sa.String(), nullable=True),
            sa.Column("postscript_name", sa.String(), nullable=True),
            sa.Column("weight_class", sa.Integer(), nullable=True),
            sa.Column("width_class", sa.Integer(), nullable=True),
            sa.Column("format", sa.String(), nullable=True),
            sa.Column("size_bytes", sa.Integer(), nullable=False),
            sa.Column("extras", sa.JSON(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
    if not _has_index(
        "font_uploads", op.f("ix_font_uploads_normalized_family_name")
    ):
        op.create_index(
            op.f("ix_font_uploads_normalized_family_name"),
            "font_uploads",
            ["normalized_family_name"],
            unique=False,
        )


def downgrade() -> None:
    if _has_table("font_uploads"):
        if _has_index(
            "font_uploads", op.f("ix_font_uploads_normalized_family_name")
        ):
            op.drop_index(
                op.f("ix_font_uploads_normalized_family_name"),
                table_name="font_uploads",
            )
        op.drop_table("font_uploads")
