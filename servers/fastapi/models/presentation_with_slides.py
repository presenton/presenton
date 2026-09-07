import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

from models.sql.slide import SlideModel


class PresentationWithSlides(BaseModel):
    id: uuid.UUID
    version: str | None = None
    content: str
    n_slides: int
    language: str
    title: str | None = None
    created_at: datetime
    updated_at: datetime
    tone: str | None = None
    verbosity: str | None = None
    slides: list[SlideModel]
    fonts: Any | None = None
    theme: dict[str, Any] | None = None
    generation_mode: Literal["standard", "smart"] = "standard"
    type: Literal["standard", "smart"] = "standard"
    community_design_ids: list[int] | None = None
