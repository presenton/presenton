from pydantic import Field

from constants.presentation import MAX_OUTLINE_CONTENT_WORDS
from models.presentation_outline_model import (
    PresentationOutlineModel,
    SlideOutlineModel,
)
from models.presentation_structure_model import PresentationStructureModel


def get_presentation_outline_model_with_n_slides(n_slides: int):
    class SlideOutlineModelWithNSlides(SlideOutlineModel):
        content: str = Field(
            description=(
                "Audience-facing Markdown content and data for the finished slide. "
                f"Maximum {MAX_OUTLINE_CONTENT_WORDS} words."
            ),
            min_length=100,
            max_length=1200,
        )

    class PresentationOutlineModelWithNSlides(PresentationOutlineModel):
        slides: list[SlideOutlineModelWithNSlides] = Field(
            description="List of slide outlines",
            min_length=n_slides,
            max_length=n_slides,
        )

    return PresentationOutlineModelWithNSlides


def get_presentation_structure_model_with_n_slides(n_slides: int):
    class PresentationStructureModelWithNSlides(PresentationStructureModel):
        slides: list[int] = Field(
            description="List of slide layouts",
            min_length=n_slides,
            max_length=n_slides,
        )

    return PresentationStructureModelWithNSlides
