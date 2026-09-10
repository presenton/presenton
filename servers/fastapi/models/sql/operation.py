import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import JSON, Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlmodel import Field, SQLModel

from utils.datetime_utils import get_current_utc_datetime


class OperationState(str, Enum):
    APPLIED = "applied"
    CONFLICT = "conflict"
    FAILED = "failed"


class OperationModel(SQLModel, table=True):
    __tablename__ = "document_operations"
    __table_args__ = (
        UniqueConstraint("document_id", "operation_id", name="uq_document_operation"),
        UniqueConstraint("document_id", "idempotency_key", name="uq_document_idempotency_key"),
    )

    id: uuid.UUID = Field(primary_key=True, default_factory=uuid.uuid4)
    document_id: uuid.UUID = Field(
        sa_column=Column(ForeignKey("presentations.id", ondelete="CASCADE"), index=True)
    )
    operation_id: uuid.UUID = Field(index=True)
    idempotency_key: str = Field(sa_column=Column(String(128), nullable=False))
    request_hash: str = Field(sa_column=Column(String(64), nullable=False))
    state: OperationState = Field(default=OperationState.APPLIED)
    actor_id: Optional[uuid.UUID] = Field(default=None, index=True)
    actor_source: str = Field(default="manual")
    base_revision: int = Field(default=0)
    resulting_revision: int = Field(default=0)
    changed_slide_ids: Optional[list] = Field(sa_column=Column(JSON), default=None)
    receipt: Optional[dict] = Field(sa_column=Column(JSON), default=None)
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=get_current_utc_datetime)
    )
