from datetime import datetime
from typing import Any

from sqlalchemy import Column, DateTime, JSON
from sqlmodel import Field, SQLModel

from utils.datetime_utils import get_current_utc_datetime


class ProviderSettings(SQLModel, table=True):
    """Singleton provider configuration migrated from userConfig.json."""

    __tablename__ = "provider_settings"

    id: int = Field(default=1, primary_key=True)
    config: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=get_current_utc_datetime,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
