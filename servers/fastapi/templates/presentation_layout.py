from typing import List, Optional

from fastapi import HTTPException
from pydantic import BaseModel, Field

from models.presentation_structure_model import PresentationStructureModel


class SlideLayoutModel(BaseModel):
    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    json_schema: dict


class PresentationLayoutModel(BaseModel):
    name: str
    ordered: bool = Field(default=False)
    slides: List[SlideLayoutModel]

    def get_slide_layout_index(self, slide_layout_id: str) -> int:
        for index, slide in enumerate(self.slides):
            if slide.id == slide_layout_id:
                return index
        raise HTTPException(
            status_code=404, detail=f"Slide layout {slide_layout_id} not found"
        )

    def to_presentation_structure(self) -> PresentationStructureModel:
        return PresentationStructureModel(
            slides=[index for index in range(len(self.slides))]
        )

    def to_string(self) -> str:
        message = "## Presentation Layout\n\n"
        for index, slide in enumerate(self.slides):
            message += f"### Slide Layout: {index}\n"
            message += f"- Name: {slide.name or slide.json_schema.get('title')}\n"
            message += f"- Description: {slide.description}\n\n"
        return message
