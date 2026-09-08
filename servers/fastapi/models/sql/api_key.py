from datetime import datetime
import secrets
import uuid
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlmodel import Field, SQLModel

from utils.datetime_utils import get_current_utc_datetime


class ApiKey(SQLModel, table=True):
    """A revocable API key scoped to one Presenton user."""

    __tablename__ = "api_keys"

    id: str = Field(
        default_factory=lambda: secrets.token_hex(8),
        primary_key=True,
        max_length=64,
    )
    secret_hash: str = Field(sa_column=Column(String(512), nullable=False))
    token_encrypted: Optional[str] = Field(
        default=None,
        exclude=True,
        sa_column=Column(String(1024), nullable=True),
    )
    user_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    created_by_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    label: str = Field(default="API client", max_length=120)
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=get_current_utc_datetime,
        )
    )
    expires_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True)
    )
    last_used_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    revoked_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True, index=True),
    )
