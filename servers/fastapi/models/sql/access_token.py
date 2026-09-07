import secrets
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey
from sqlmodel import Field, SQLModel

from utils.datetime_utils import get_current_utc_datetime


class AccessToken(SQLModel, table=True):
    __tablename__ = "access_tokens"

    token: str = Field(
        default_factory=lambda: f"sk-presenton-{secrets.token_hex(20)}",
        index=True,
        primary_key=True,
    )
    user_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=get_current_utc_datetime,
        )
    )
