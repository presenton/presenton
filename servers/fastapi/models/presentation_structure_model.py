from pydantic import BaseModel, Field


class PresentationStructureModel(BaseModel):
    slides: list[int] = Field(description="List of slide layout indexes")
