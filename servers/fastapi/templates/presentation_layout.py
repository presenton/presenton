import json
from typing import List, Optional

from fastapi import HTTPException
from pydantic import BaseModel, Field, model_validator

from models.presentation_structure_model import PresentationStructureModel
from utils.icon_weights import DEFAULT_ICON_WEIGHT, extract_icon_weight_from_settings


class SlideLayoutModel(BaseModel):
    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    json_schema: dict


class PresentationLayoutModel(BaseModel):
    name: str
    ordered: bool = Field(default=False)
    icon_weight: str = Field(default=DEFAULT_ICON_WEIGHT)
    slides: List[SlideLayoutModel]

    @model_validator(mode="before")
    @classmethod
    def normalize_icon_weight(cls, data):
        if isinstance(data, dict):
            normalized = dict(data)
            normalized["icon_weight"] = extract_icon_weight_from_settings(normalized)
            return normalized
        return data

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

    def to_string(self, with_schema: bool = False) -> str:
        message = "## Presentation Layout\n\n"
        for index, slide in enumerate(self.slides):
            message += f"### Slide Layout: {index}\n"
            message += f"- Name: {slide.name or slide.json_schema.get('title')}\n"
            message += f"- Description: {slide.description}\n"
            if with_schema:
                try:
                    schema_text = json.dumps(slide.json_schema, ensure_ascii=False)
                except (TypeError, ValueError):
                    schema_text = str(slide.json_schema)
                message += f"- Schema: {schema_text}\n"
            message += "\n"
        return message
