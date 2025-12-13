from datetime import datetime
from typing import List, Optional
import uuid
from sqlalchemy import JSON, Column, DateTime, String, Text
from sqlmodel import Boolean, Field, SQLModel

from models.presentation_layout import PresentationLayoutModel
from models.presentation_outline_model import PresentationOutlineModel
from models.presentation_structure_model import PresentationStructureModel
from utils.datetime_utils import get_current_utc_datetime


class PresentationModel(SQLModel, table=True):
    __tablename__ = "presentations"

    id: uuid.UUID = Field(primary_key=True, default_factory=uuid.uuid4)
    content: str = Field(sa_column=Column(Text, nullable=False))
    n_slides: int
    language: str
    title: Optional[str] = None
    file_paths: Optional[List[str]] = Field(sa_column=Column(JSON), default=None)
    outlines: Optional[dict] = Field(sa_column=Column(JSON), default=None)
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=False, default=get_current_utc_datetime
        ),
    )
    updated_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=get_current_utc_datetime,
            onupdate=get_current_utc_datetime,
        ),
    )
    layout: Optional[dict] = Field(sa_column=Column(JSON), default=None)
    structure: Optional[dict] = Field(sa_column=Column(JSON), default=None)
    instructions: Optional[str] = Field(sa_column=Column(Text), default=None)
    tone: Optional[str] = Field(sa_column=Column(String(128)), default=None)
    verbosity: Optional[str] = Field(sa_column=Column(String(56)), default=None)
    include_table_of_contents: bool = Field(sa_column=Column(Boolean), default=False)
    include_title_slide: bool = Field(sa_column=Column(Boolean), default=True)
    web_search: bool = Field(sa_column=Column(Boolean), default=False)

    def get_new_presentation(self):
        return PresentationModel(
            id=uuid.uuid4(),
            content=self.content,
            n_slides=self.n_slides,
            language=self.language,
            title=self.title,
            file_paths=self.file_paths,
            outlines=self.outlines,
            layout=self.layout,
            structure=self.structure,
            instructions=self.instructions,
            tone=self.tone,
            verbosity=self.verbosity,
            include_table_of_contents=self.include_table_of_contents,
            include_title_slide=self.include_title_slide,
        )

    def get_presentation_outline(self):
        if not self.outlines:
            return None
        return PresentationOutlineModel(**self.outlines)

    def get_layout(self):
        return PresentationLayoutModel(**self.layout)

    def set_layout(self, layout: PresentationLayoutModel):
        self.layout = layout.model_dump()

    def get_structure(self):
        if not self.structure:
            return None
        return PresentationStructureModel(**self.structure)

    def set_structure(self, structure: PresentationStructureModel):
        self.structure = structure.model_dump()
