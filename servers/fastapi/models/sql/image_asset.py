import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey
from sqlmodel import Field, SQLModel

from api.v1.auth.context import get_current_owner_id
from utils.datetime_utils import get_current_utc_datetime


class ImageAsset(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID | None = Field(
        default_factory=get_current_owner_id,
        exclude=True,
        sa_column=Column(ForeignKey("user.id", ondelete="CASCADE"), nullable=True, index=True),
    )
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=get_current_utc_datetime),
    )
    is_uploaded: bool = Field(default=False)
    path: str
    extras: dict | None = Field(sa_column=Column(JSON), default=None)
