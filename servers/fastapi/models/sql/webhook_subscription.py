import secrets
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey
from sqlmodel import Column, DateTime, Field, SQLModel

from api.v1.auth.context import get_current_owner_id
from utils.datetime_utils import get_current_utc_datetime


class WebhookSubscription(SQLModel, table=True):
    __tablename__ = "webhook_subscriptions"

    id: str = Field(default_factory=lambda: f"webhook-{secrets.token_hex(32)}", primary_key=True)
    owner_id: uuid.UUID | None = Field(
        default_factory=get_current_owner_id,
        exclude=True,
        sa_column=Column(ForeignKey("user.id", ondelete="CASCADE"), nullable=True, index=True),
    )
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False),
        default_factory=get_current_utc_datetime,
    )
    url: str
    secret: str | None = None
    event: str = Field(index=True)
