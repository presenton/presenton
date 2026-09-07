import secrets
import uuid
from datetime import datetime
from typing import Any

from pydantic import field_serializer
from sqlalchemy import JSON, Column, DateTime, ForeignKey, String
from sqlmodel import Field, SQLModel

from api.v1.auth.context import get_current_owner_id
from enums.async_task_status import AsyncTaskStatus
from utils.datetime_utils import get_current_utc_datetime


class AsyncTaskModel(SQLModel, table=True):
    __tablename__ = "async_tasks"

    id: str = Field(
        default_factory=lambda: f"task-{secrets.token_hex(32)}",
        primary_key=True,
    )
    owner_id: uuid.UUID | None = Field(
        default_factory=get_current_owner_id,
        exclude=True,
        sa_column=Column(ForeignKey("user.id", ondelete="CASCADE"), nullable=True, index=True),
    )
    type: str = Field(index=True)
    status: AsyncTaskStatus = Field(
        sa_column=Column(String, index=True, nullable=False),
    )
    message: str | None = None
    error: dict[str, Any] | None = Field(sa_column=Column(JSON), default=None)
    data: dict[str, Any] | None = Field(sa_column=Column(JSON), default=None)
    payload: dict[str, Any] | None = Field(
        default=None,
        exclude=True,
        sa_column=Column(JSON, nullable=True),
    )
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=get_current_utc_datetime,
        )
    )
    updated_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=get_current_utc_datetime,
            onupdate=get_current_utc_datetime,
        )
    )

    @field_serializer("status")
    def serialize_status(self, status: AsyncTaskStatus | str) -> str:
        """Serialize values hydrated from the database's string column."""
        return status.value if isinstance(status, AsyncTaskStatus) else status
