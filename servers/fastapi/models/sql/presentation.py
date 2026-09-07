import copy
import uuid
from datetime import datetime
from enum import Enum
from typing import Literal

from sqlalchemy import JSON, Column, DateTime, ForeignKey, String
from sqlalchemy import Enum as SAEnum
from sqlmodel import Boolean, Field, SQLModel

from api.v1.auth.context import get_current_owner_id
from models.presentation_layout import PresentationLayoutModel
from models.presentation_outline_model import PresentationOutlineModel
from models.presentation_structure_model import PresentationStructureModel
from utils.datetime_utils import get_current_utc_datetime


class PresentationVersion(str, Enum):
    V1_STANDARD = "v1-standard"
    V2_STANDARD = "v2-standard"


class PresentationModel(SQLModel, table=True):
    __tablename__ = "presentations"

    id: uuid.UUID = Field(primary_key=True, default_factory=uuid.uuid4)
    owner_id: uuid.UUID | None = Field(
        default_factory=get_current_owner_id,
        exclude=True,
        sa_column=Column(
            ForeignKey("user.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
    )
    version: PresentationVersion = Field(
        sa_column=Column(
            SAEnum(
                PresentationVersion,
                values_callable=lambda enum: [item.value for item in enum],
                name="presentation_version",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
    )
    content: str
    n_slides: int
    language: str
    title: str | None = None
    file_paths: list[str] | None = Field(sa_column=Column(JSON), default=None)
    outlines: dict | None = Field(sa_column=Column(JSON), default=None)
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=get_current_utc_datetime),
    )
    updated_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=get_current_utc_datetime,
            onupdate=get_current_utc_datetime,
        ),
    )
    layout: dict | None = Field(sa_column=Column(JSON), default=None)
    structure: dict | None = Field(sa_column=Column(JSON), default=None)
    instructions: str | None = Field(sa_column=Column(String), default=None)
    tone: str | None = Field(sa_column=Column(String), default=None)
    verbosity: str | None = Field(sa_column=Column(String), default=None)
    include_table_of_contents: bool = Field(sa_column=Column(Boolean), default=False)
    include_title_slide: bool = Field(sa_column=Column(Boolean), default=True)
    web_search: bool = Field(sa_column=Column(Boolean), default=False)
    theme: dict | None = Field(sa_column=Column(JSON), default=None)
    fonts: dict | None = Field(sa_column=Column(JSON), default=None)
    generation_mode: Literal["standard", "smart"] = Field(
        sa_column=Column(String, nullable=False, default="standard"),
        default="standard",
    )
    community_design_ids: list[int] | None = Field(sa_column=Column(JSON), default=None)

    def get_new_presentation(self):
        return PresentationModel(
            id=uuid.uuid4(),
            owner_id=self.owner_id,
            version=self.version,
            content=self.content,
            n_slides=self.n_slides,
            language=self.language,
            title=self.title,
            file_paths=copy.deepcopy(self.file_paths),
            outlines=copy.deepcopy(self.outlines),
            layout=copy.deepcopy(self.layout),
            structure=copy.deepcopy(self.structure),
            instructions=self.instructions,
            tone=self.tone,
            verbosity=self.verbosity,
            include_table_of_contents=self.include_table_of_contents,
            include_title_slide=self.include_title_slide,
            web_search=self.web_search,
            theme=copy.deepcopy(self.theme),
            fonts=copy.deepcopy(self.fonts),
            generation_mode=self.generation_mode,
            community_design_ids=copy.deepcopy(self.community_design_ids),
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
