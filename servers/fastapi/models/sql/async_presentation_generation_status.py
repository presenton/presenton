import secrets
import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, ForeignKey
from sqlmodel import Field, SQLModel

from api.v1.auth.context import get_current_owner_id


class AsyncPresentationGenerationTaskModel(SQLModel, table=True):
    __tablename__ = "async_presentation_generation_tasks"

    id: str = Field(default_factory=lambda: f"task-{secrets.token_hex(32)}", primary_key=True)
    owner_id: uuid.UUID | None = Field(
        default_factory=get_current_owner_id,
        exclude=True,
        sa_column=Column(ForeignKey("user.id", ondelete="CASCADE"), nullable=True, index=True),
    )
    status: str
    message: str | None = None
    error: dict | None = Field(sa_column=Column(JSON), default=None)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    data: dict | None = Field(sa_column=Column(JSON), default=None)
