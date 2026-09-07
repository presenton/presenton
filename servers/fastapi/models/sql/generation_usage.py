import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey
from sqlmodel import Field, SQLModel

from api.v1.auth.context import get_current_owner_id
from utils.datetime_utils import get_current_utc_datetime


class GenerationUsageModel(SQLModel, table=True):
    """Одна строка = один запуск генерации презентации (учёт квот, P4).

    Считаем старты, а не готовые презентации: неудачная генерация тоже
    расходует общий LLM-бюджет.
    """

    __tablename__ = "generation_usage"

    id: uuid.UUID = Field(primary_key=True, default_factory=uuid.uuid4)
    owner_id: uuid.UUID | None = Field(
        default_factory=get_current_owner_id,
        exclude=True,
        sa_column=Column(ForeignKey("user.id", ondelete="CASCADE"), nullable=True, index=True),
    )
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=get_current_utc_datetime),
    )
