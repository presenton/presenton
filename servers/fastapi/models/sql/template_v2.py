import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey
from sqlmodel import Field, SQLModel

from api.v1.auth.context import get_current_owner_id
from utils.datetime_utils import get_current_utc_datetime


def _new_template_v2_id() -> str:
    return str(uuid.uuid4())


class TemplateV2(SQLModel, table=True):
    __tablename__ = "template_v2"

    id: str = Field(primary_key=True, default_factory=_new_template_v2_id)
    owner_id: uuid.UUID | None = Field(
        default_factory=get_current_owner_id,
        exclude=True,
        sa_column=Column(ForeignKey("user.id", ondelete="CASCADE"), nullable=True, index=True),
    )
    name: str = Field(nullable=False)
    description: str | None = Field(default=None, nullable=True)
    raw_layouts: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    components: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    merged_components: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    layouts: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    theme: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    assets: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    is_default: bool = Field(default=False, nullable=False)
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=get_current_utc_datetime)
    )
    updated_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=get_current_utc_datetime,
            onupdate=get_current_utc_datetime,
        )
    )
