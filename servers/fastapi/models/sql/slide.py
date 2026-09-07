import copy
import uuid

from sqlalchemy import ForeignKey
from sqlmodel import JSON, Column, Field, SQLModel

from api.v1.auth.context import get_current_owner_id


class SlideModel(SQLModel, table=True):
    __tablename__ = "slides"

    id: uuid.UUID = Field(primary_key=True, default_factory=uuid.uuid4)
    owner_id: uuid.UUID | None = Field(
        default_factory=get_current_owner_id,
        exclude=True,
        sa_column=Column(ForeignKey("user.id", ondelete="CASCADE"), nullable=True, index=True),
    )
    presentation: uuid.UUID = Field(
        sa_column=Column(ForeignKey("presentations.id", ondelete="CASCADE"), index=True)
    )
    layout_group: str
    layout: str
    index: int
    content: dict = Field(sa_column=Column(JSON))
    html_content: str | None = None
    speaker_note: str | None = None
    properties: dict | None = Field(sa_column=Column(JSON))
    ui: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))

    def get_new_slide(self, presentation: uuid.UUID, content: dict | None = None):
        return SlideModel(
            id=uuid.uuid4(),
            owner_id=self.owner_id,
            presentation=presentation,
            layout_group=self.layout_group,
            layout=self.layout,
            index=self.index,
            speaker_note=self.speaker_note,
            content=copy.deepcopy(content or self.content),
            html_content=self.html_content,
            properties=copy.deepcopy(self.properties),
            ui=copy.deepcopy(self.ui),
        )
