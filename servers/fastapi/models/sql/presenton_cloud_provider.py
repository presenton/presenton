import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.sql.user import UserBase
from utils.datetime_utils import get_current_utc_datetime


class PresentonCloudProvider(UserBase):
    """Singleton, administrator-managed Presenton Cloud provider credentials."""

    __tablename__ = "presenton_cloud_provider"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    issuer: Mapped[str] = mapped_column(String(512), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    access_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=get_current_utc_datetime,
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=get_current_utc_datetime,
        onupdate=get_current_utc_datetime,
    )
