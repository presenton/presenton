from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from utils.image_config import migrate_legacy_image_config

from enums.image_provider import ImageProvider


class ImageProviderTestConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="before")
    @classmethod
    def migrate_image_config(cls, data):
        return migrate_legacy_image_config(data) if isinstance(data, dict) else data

    IMAGE_PROVIDER: ImageProvider
    OPENAI_API_KEY: str = Field(default="", repr=False)
    GOOGLE_API_KEY: str = Field(default="", repr=False)
    PEXELS_API_KEY: str = Field(default="", repr=False)
    PIXABAY_API_KEY: str = Field(default="", repr=False)
    COMFYUI_URL: str = ""
    COMFYUI_WORKFLOW: str = ""
    OPEN_WEBUI_IMAGE_URL: str = ""
    OPEN_WEBUI_IMAGE_API_KEY: str = Field(default="", repr=False)
    OPENAI_COMPAT_IMAGE_BASE_URL: str = ""
    OPENAI_COMPAT_IMAGE_API_KEY: str = Field(default="", repr=False)
    OPENAI_COMPAT_IMAGE_MODEL: str = ""
    GPT_IMAGE_2_QUALITY: Literal["low", "medium", "high"] = "medium"
    GPT_IMAGE_2_5_QUALITY: Literal["low", "medium", "high", "xhigh", "max", "auto"] = "medium"
