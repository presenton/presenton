from datetime import datetime
from typing import Optional
import uuid

from sqlalchemy import JSON, Column, DateTime, Integer, String
from sqlmodel import Field, SQLModel

from utils.datetime_utils import get_current_utc_datetime


class FontUpload(SQLModel, table=True):
    __tablename__ = "font_uploads"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=False, default=get_current_utc_datetime
        ),
    )
    filename: str
    path: str
    normalized_family_name: str = Field(index=True)
    family_name: Optional[str] = Field(sa_column=Column(String), default=None)
    subfamily_name: Optional[str] = Field(sa_column=Column(String), default=None)
    full_name: Optional[str] = Field(sa_column=Column(String), default=None)
    postscript_name: Optional[str] = Field(sa_column=Column(String), default=None)
    weight_class: Optional[int] = Field(sa_column=Column(Integer), default=None)
    width_class: Optional[int] = Field(sa_column=Column(Integer), default=None)
    format: Optional[str] = Field(sa_column=Column(String), default=None)
    size_bytes: int
    extras: Optional[dict] = Field(sa_column=Column(JSON), default=None)
