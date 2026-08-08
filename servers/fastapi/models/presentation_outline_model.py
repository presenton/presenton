from typing import List
from pydantic import BaseModel, Field, field_validator

from constants.presentation import MAX_NUMBER_OF_SLIDES, MAX_OUTLINE_CONTENT_WORDS
from utils.outline_limits import normalize_outline_content


class SlideOutlineModel(BaseModel):
    content: str = Field(
        ...,
        description=(
            "Audience-facing Markdown content and data for the finished slide; never "
            "slide-creation commands, visual/layout configuration, styling notes, or "
            f"model instructions. Maximum {MAX_OUTLINE_CONTENT_WORDS} words."
        ),
    )

    @field_validator("content", mode="before")
    @classmethod
    def limit_content_words(cls, value):
        return normalize_outline_content(value)


class PresentationOutlineModel(BaseModel):
    slides: List[SlideOutlineModel] = Field(
        description="List of slide outlines",
        max_length=MAX_NUMBER_OF_SLIDES,
    )

    def to_string(self):
        message = ""
        for i, slide in enumerate(self.slides):
            message += f"## Slide {i+1}:\n"
            message += f"  - Content: {slide} \n"
        return message
