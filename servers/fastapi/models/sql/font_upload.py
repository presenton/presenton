import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Integer, String
from sqlmodel import Field, SQLModel

from utils.datetime_utils import get_current_utc_datetime


class FontUpload(SQLModel, table=True):
    __tablename__ = "font_uploads"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=get_current_utc_datetime),
    )
    filename: str
    path: str
    normalized_family_name: str = Field(index=True)
    family_name: str | None = Field(sa_column=Column(String), default=None)
    subfamily_name: str | None = Field(sa_column=Column(String), default=None)
    full_name: str | None = Field(sa_column=Column(String), default=None)
    postscript_name: str | None = Field(sa_column=Column(String), default=None)
    weight_class: int | None = Field(sa_column=Column(Integer), default=None)
    width_class: int | None = Field(sa_column=Column(Integer), default=None)
    format: str | None = Field(sa_column=Column(String), default=None)
    size_bytes: int
    extras: dict | None = Field(sa_column=Column(JSON), default=None)
