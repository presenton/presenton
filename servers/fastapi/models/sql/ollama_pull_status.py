from datetime import datetime

from sqlmodel import JSON, Column, DateTime, Field, SQLModel


class OllamaPullStatus(SQLModel, table=True):
    id: str = Field(primary_key=True)
    last_updated: datetime = Field(sa_column=Column(DateTime, default=datetime.now))
    status: dict = Field(sa_column=Column(JSON))
