import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, Column, DateTime
from sqlmodel import Field, SQLModel


def _utcnow():
    return datetime.now(timezone.utc)


class DocumentJobModel(SQLModel, table=True):
    __tablename__ = "document_jobs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    document_id: Optional[uuid.UUID] = Field(default=None, foreign_key="presentations.id", index=True)
    kind: str = Field(default="outbox", max_length=64)
    status: str = Field(default="pending", max_length=32, index=True)
    payload: Optional[dict] = Field(default=None, sa_column=Column(JSON, nullable=True))
    lease_owner: Optional[str] = Field(default=None, max_length=128)
    lease_until: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    attempts: int = Field(default=0)
    created_at: datetime = Field(default_factory=_utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=_utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
