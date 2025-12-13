from typing import Optional
import uuid
from sqlalchemy import ForeignKey
from sqlmodel import Field, Column, JSON, SQLModel, Text


class SlideModel(SQLModel, table=True):
    __tablename__ = "slides"

    id: uuid.UUID = Field(primary_key=True, default_factory=uuid.uuid4)
    presentation: uuid.UUID = Field(
        sa_column=Column(ForeignKey("presentations.id", ondelete="CASCADE"), index=True)
    )
    layout_group: str
    layout: str
    index: int
    content: dict = Field(sa_column=Column(JSON))
    html_content: Optional[str]
    speaker_note: Optional[str] = Field(sa_column=Column(Text), default=None)
    properties: Optional[dict] = Field(sa_column=Column(JSON))

    def get_new_slide(self, presentation: uuid.UUID, content: Optional[dict] = None):
        return SlideModel(
            id=uuid.uuid4(),
            presentation=presentation,
            layout_group=self.layout_group,
            layout=self.layout,
            index=self.index,
            speaker_note=self.speaker_note,
            content=content or self.content,
            properties=self.properties,
        )
