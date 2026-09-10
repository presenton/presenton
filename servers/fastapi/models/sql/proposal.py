import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Column, DateTime, ForeignKey, String
from sqlmodel import Field, SQLModel

from utils.datetime_utils import get_current_utc_datetime


class ProposalModel(SQLModel, table=True):
    __tablename__ = "document_proposals"

    id: uuid.UUID = Field(primary_key=True, default_factory=uuid.uuid4)
    document_id: uuid.UUID = Field(
        sa_column=Column(ForeignKey("presentations.id", ondelete="CASCADE"), index=True)
    )
    base_revision: int = Field(default=0)
    operations: list = Field(sa_column=Column(JSON), default_factory=list)
    status: str = Field(sa_column=Column(String(32), nullable=False), default="ready")
    payload_hash: str = Field(sa_column=Column(String(64), nullable=False), default="")
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=get_current_utc_datetime)
    )
