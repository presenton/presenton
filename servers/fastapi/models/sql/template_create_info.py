from datetime import datetime
import uuid

from sqlalchemy import JSON, Column, DateTime
from sqlmodel import Field, SQLModel

from utils.datetime_utils import get_current_utc_datetime


class TemplateCreateInfoModel(SQLModel, table=True):
    __tablename__ = "template_create_infos"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    fonts: dict[str, str] | None = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )
    pptx_url: str | None = Field(default=None)
    slide_htmls: list[str] = Field(sa_column=Column(JSON, nullable=False))
    slide_image_urls: list[str] = Field(sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=False, default=get_current_utc_datetime
        )
    )
