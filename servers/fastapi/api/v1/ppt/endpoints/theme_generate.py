import re
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from llmai import get_client
from llmai.shared import ImageContentPart, JSONSchemaResponse, SystemMessage, UserMessage
from pydantic import BaseModel, Field, field_validator

from models.theme_data import GeneratedColorPalette, ThemeData
from utils.llm_client_error_handler import handle_llm_client_exceptions
from utils.llm_config import get_llm_config
from utils.llm_provider import get_model
from utils.llm_utils import generate_structured_with_schema_retries
from utils.schema_utils import prepare_schema_for_validation
from utils.theme_utils import (
    IS_DARK_BELOW,
    generate_color_palette,
    get_lightness_key_at_distance,
)

THEME_ROUTER = APIRouter(prefix="/theme", tags=["V3 Theme"])

_HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
_MAX_IMAGE_BYTES = 8 * 1024 * 1024
_ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}

_STYLE_TRANSFER_SYSTEM_PROMPT = (
    "Extract a 6-color theme palette from this reference image: primary (a "
    "strong accent/brand color visible in the image), background (the "
    "dominant ground/base tone), accent_1 and accent_2 (two supporting "
    "colors), text_1 and text_2 (two colors that would be legible as text "
    "against the background you identified — make sure they contrast). "
    "Also give a 2-5 word 'mood' description of the visual style (e.g. "
    "'dark futuristic glass', 'warm editorial minimal'). Return all six "
    "colors as #RRGGBB hex."
)


class ReferencePalette(BaseModel):
    primary: str
    background: str
    accent_1: str
    accent_2: str
    text_1: str
    text_2: str
    mood: str = Field(description="Two to five words describing the visual style")

    @field_validator("primary", "background", "accent_1", "accent_2", "text_1", "text_2")
    @classmethod
    def _validate_hex(cls, v: str) -> str:
        if not _HEX_RE.match(v):
            raise ValueError(f"Expected a #RRGGBB hex color, got {v!r}")
        return v


class ThemeFromImageResponse(BaseModel):
    theme: ThemeData
    seeds: ReferencePalette


class GenerateThemeRequestV3(BaseModel):
    primary: Optional[str] = None
    background: Optional[str] = None
    accent_1: Optional[str] = None
    accent_2: Optional[str] = None
    text_1: Optional[str] = None
    text_2: Optional[str] = None


def theme_data_from_palette(color_palette: GeneratedColorPalette) -> ThemeData:
    is_dark_theme = color_palette.background_lightness < IS_DARK_BELOW
    graph_colors = list(color_palette.primary_variations.values())

    if not is_dark_theme:
        graph_colors.reverse()

    return ThemeData(
        primary=color_palette.primary,
        background=color_palette.background,
        card=color_palette.background_variations[
            get_lightness_key_at_distance(
                color_palette.background_lightness,
                min_distance=1,
                max_distance=1,
                prefer_dark=not is_dark_theme,
            )
        ],
        stroke=color_palette.background_variations[
            get_lightness_key_at_distance(
                color_palette.background_lightness,
                min_distance=2,
                max_distance=2,
                prefer_dark=not is_dark_theme,
            )
        ],
        background_text=color_palette.text_1,
        primary_text=color_palette.text_2,
        graph_0=graph_colors[0],
        graph_1=graph_colors[1],
        graph_2=graph_colors[2],
        graph_3=graph_colors[3],
        graph_4=graph_colors[4],
        graph_5=graph_colors[5],
        graph_6=graph_colors[6],
        graph_7=graph_colors[7],
        graph_8=graph_colors[8],
        graph_9=graph_colors[9],
    )


@THEME_ROUTER.post("/generate", response_model=ThemeData)
async def generate_theme_v3(request: GenerateThemeRequestV3) -> ThemeData:
    color_palette = generate_color_palette(
        request.primary,
        request.background,
        request.accent_1,
        request.accent_2,
        request.text_1,
        request.text_2,
    )
    return theme_data_from_palette(color_palette)


@THEME_ROUTER.post("/from-image", response_model=ThemeFromImageResponse)
async def generate_theme_from_image(
    image: UploadFile = File(...),
) -> ThemeFromImageResponse:
    if image.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type '{image.content_type}'. "
            f"Accepted types: {sorted(_ALLOWED_CONTENT_TYPES)}",
        )

    image_bytes = await image.read()
    if len(image_bytes) > _MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Image exceeds the maximum allowed size of {_MAX_IMAGE_BYTES} bytes",
        )

    try:
        client = get_client(config=get_llm_config())
        model = get_model()
        schema = prepare_schema_for_validation(
            ReferencePalette.model_json_schema(),
            strict=False,
        )
        content = await generate_structured_with_schema_retries(
            client,
            model,
            messages=[
                SystemMessage(content=_STYLE_TRANSFER_SYSTEM_PROMPT),
                UserMessage(
                    content=[
                        ImageContentPart(data=image_bytes, mime_type=image.content_type),
                        "Extract the reference palette from this image.",
                    ]
                ),
            ],
            response_format=JSONSchemaResponse(
                name="reference_palette",
                json_schema=schema,
                strict=False,
            ),
            json_schema=schema,
            validate_schema=True,
        )
        seeds = ReferencePalette(**content)
    except Exception as e:
        raise handle_llm_client_exceptions(e)

    palette = generate_color_palette(
        seeds.primary,
        seeds.background,
        seeds.accent_1,
        seeds.accent_2,
        seeds.text_1,
        seeds.text_2,
    )
    return ThemeFromImageResponse(theme=theme_data_from_palette(palette), seeds=seeds)

