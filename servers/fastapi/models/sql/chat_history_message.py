import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, String, Text
from sqlmodel import Field, SQLModel

from api.v1.auth.context import get_current_owner_id
from utils.datetime_utils import get_current_utc_datetime


class ChatHistoryMessageModel(SQLModel, table=True):
    __tablename__ = "chat_history_messages"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID | None = Field(
        default_factory=get_current_owner_id,
        exclude=True,
        sa_column=Column(ForeignKey("user.id", ondelete="CASCADE"), nullable=True, index=True),
    )
    presentation_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            ForeignKey("presentations.id", ondelete="CASCADE"),
            index=True,
            nullable=True,
        ),
    )
    template_v2_id: str | None = Field(
        default=None,
        sa_column=Column(
            String,
            ForeignKey("template_v2.id", ondelete="CASCADE"),
            index=True,
            nullable=True,
        ),
    )
    conversation_id: uuid.UUID = Field(index=True)
    position: int = Field(index=True, ge=1)
    role: str
    content: str = Field(sa_column=Column(Text, nullable=False))
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=get_current_utc_datetime)
    )
    tool_calls: list[str] | None = Field(sa_column=Column(JSON), default=None)
