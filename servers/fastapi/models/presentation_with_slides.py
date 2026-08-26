from typing import Any, List, Literal, Optional
from datetime import datetime
import uuid

from pydantic import BaseModel

from models.sql.slide import SlideModel


class PresentationWithSlides(BaseModel):
    id: uuid.UUID
    version: Optional[str] = None
    content: str
    n_slides: int
    language: str
    title: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    tone: Optional[str] = None
    verbosity: Optional[str] = None
    slides: List[SlideModel]
    fonts: Optional[Any] = None
    theme: Optional[dict[str, Any]] = None
    generation_mode: Literal["standard", "smart"] = "standard"
    type: Literal["standard", "smart"] = "standard"
    community_design_ids: Optional[List[int]] = None
