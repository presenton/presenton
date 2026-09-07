import datetime
import uuid

from sqlalchemy import Boolean, DateTime, Integer, String, Uuid, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlmodel import SQLModel

from utils.datetime_utils import get_current_utc_datetime


class UserBase(DeclarativeBase):
    metadata = SQLModel.metadata


class User(UserBase):
    """Username-only account model used by the FastAPI Users manager."""

    __tablename__ = "user"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    admin_slot: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(1024), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    is_superuser: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    created_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=get_current_utc_datetime
    )
    auth_version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    # NULL = лимит по умолчанию из GENERATION_QUOTA_PER_DAY (квоты, P4).
    generation_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
