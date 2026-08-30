"""backfill Smart presentation generation mode

Revision ID: d2f4a6b8c0e1
Revises: c6e8f1a3b5d7
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d2f4a6b8c0e1"
down_revision: str | None = "c6e8f1a3b5d7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if not {"presentations", "slides"}.issubset(tables):
        return

    presentation_columns = {
        column["name"] for column in inspector.get_columns("presentations")
    }
    slide_columns = {column["name"] for column in inspector.get_columns("slides")}
    if "generation_mode" not in presentation_columns or not {
        "presentation",
        "html_content",
    }.issubset(slide_columns):
        return

    op.execute(
        sa.text(
            """
            UPDATE presentations
            SET generation_mode = 'smart'
            WHERE generation_mode <> 'smart'
              AND EXISTS (
                  SELECT 1
                  FROM slides
                  WHERE slides.presentation = presentations.id
                    AND slides.html_content IS NOT NULL
                    AND TRIM(slides.html_content) <> ''
              )
            """
        )
    )


def downgrade() -> None:
    # The prior value cannot be reconstructed safely. Keeping the corrected
    # classification is preferable to changing Smart decks back to Standard.
    pass
