from datetime import datetime
from typing import Optional
import uuid

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Text
from sqlmodel import Field, SQLModel

from utils.datetime_utils import get_current_utc_datetime
from api.v1.auth.context import get_current_owner_id


class PresentationLayoutCodeModel(SQLModel, table=True):
    __tablename__ = "presentation_layout_codes"

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: Optional[uuid.UUID] = Field(
        default_factory=get_current_owner_id,
        exclude=True,
        sa_column=Column(
            ForeignKey("user.id", ondelete="CASCADE"), nullable=True, index=True
        ),
    )
    presentation: uuid.UUID = Field(index=True, description="UUID of the presentation")
    layout_id: str = Field(description="Unique identifier for the layout")
    layout_name: str = Field(description="Display name of the layout")
    layout_code: str = Field(
        sa_column=Column(Text), description="TSX/React component code for the layout"
    )
    fonts: Optional[dict[str, str] | list[str]] = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
        description="Optional font metadata associated with the layout",
    )
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=False, default=get_current_utc_datetime
        )
    )
    updated_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=get_current_utc_datetime,
            onupdate=get_current_utc_datetime,
        ),
    )
