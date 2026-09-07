import uuid

from sqlmodel import JSON, Column, Field, SQLModel


class KeyValueSqlModel(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    key: str = Field(index=True)
    value: dict = Field(sa_column=Column(JSON))
