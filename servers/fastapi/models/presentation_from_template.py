import uuid
from typing import Literal

from pydantic import BaseModel


class SlideContentUpdate(BaseModel):
    index: int
    content: dict


class EditPresentationRequest(BaseModel):
    presentation_id: uuid.UUID
    slides: list[SlideContentUpdate]
    export_as: Literal["pptx", "pdf"] = "pptx"
