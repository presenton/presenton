from fastapi import APIRouter
from pydantic import BaseModel

from models.theme_data import ThemeData
from utils.theme_utils import (
    IS_DARK_BELOW,
    generate_color_palette,
    get_lightness_key_at_distance,
)

THEME_ROUTER = APIRouter(prefix="/theme", tags=["V3 Theme"])


class GenerateThemeRequestV3(BaseModel):
    primary: str | None = None
    background: str | None = None
    accent_1: str | None = None
    accent_2: str | None = None
    text_1: str | None = None
    text_2: str | None = None


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

    is_dark_theme = color_palette.background_lightness < IS_DARK_BELOW
    graph_colors = list(color_palette.primary_variations.values())

    if not is_dark_theme:
        graph_colors.reverse()

    theme_data = ThemeData(
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
    return theme_data
