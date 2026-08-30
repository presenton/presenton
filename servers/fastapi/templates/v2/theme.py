from __future__ import annotations

import colorsys
import json
import logging
import math
import re
from dataclasses import dataclass, field
from typing import Any

from llmai import get_client
from llmai.shared import SystemMessage, UserMessage
from pydantic import BaseModel, ConfigDict, Field

from models.theme_data import (
    PresentationThemeColors,
    PresentationThemeData,
    PresentationThemeFonts,
    PresentationThemeTextFont,
)
from templates.v2.models.layouts import SlideLayouts
from utils.llm_config import get_llm_config
from utils.llm_provider import get_model


LOGGER = logging.getLogger(__name__)
MAX_PROFILE_COLORS = 14
MAX_PROFILE_PAIRS = 8
MAX_PROFILE_FONTS = 5
NEAR_COLOR_DISTANCE = 8.0
SLIDE_AREA = 1280.0 * 720.0


class ProfileColor(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    hex: str
    fill_count: int = 0
    fill_area: float = 0
    text_count: int = 0
    stroke_count: int = 0
    chart_count: int = 0
    infographic_count: int = 0
    slide_count: int = 0
    lightness: float
    saturation: float


class ProfileColorPair(BaseModel):
    model_config = ConfigDict(extra="forbid")

    foreground: str
    background: str
    count: int
    contrast: float


class ProfileFont(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    family: str
    usage_count: int
    average_size: float | None = None
    url: str | None = None


class ThemeProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    colors: list[ProfileColor]
    color_pairs: list[ProfileColorPair]
    fonts: list[ProfileFont]


class ThemeRoleSelection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    primary: str
    background: str
    card: str
    stroke: str
    background_text: str
    primary_text: str
    graph_colors: list[str] = Field(min_length=1, max_length=10)
    text_font: str | None = None


@dataclass
class _ColorStats:
    hex: str
    fill_count: int = 0
    fill_area: float = 0.0
    text_count: int = 0
    stroke_count: int = 0
    chart_count: int = 0
    infographic_count: int = 0
    slides: set[int] = field(default_factory=set)

    @property
    def importance(self) -> float:
        return (
            self.fill_area * 12
            + self.fill_count
            + self.text_count * 1.5
            + self.stroke_count * 0.75
            + self.chart_count * 2
            + self.infographic_count * 2
            + len(self.slides)
        )

    def merge(self, other: "_ColorStats") -> None:
        self.fill_count += other.fill_count
        self.fill_area += other.fill_area
        self.text_count += other.text_count
        self.stroke_count += other.stroke_count
        self.chart_count += other.chart_count
        self.infographic_count += other.infographic_count
        self.slides.update(other.slides)


@dataclass
class _FontStats:
    family: str
    usage_count: int = 0
    total_size: float = 0.0
    sized_count: int = 0


THEME_ROLE_SYSTEM_PROMPT = """
Select semantic presentation theme roles from the compact style profile.

Return only candidate IDs present in the profile. Do not invent colors or fonts.
- background: a large, frequently repeated surface color.
- primary: the dominant branded/accent color, not a neutral background.
- background_text and primary_text: observed text colors that contrast with their surfaces.
- card: a secondary surface; stroke: a subtle structural or border color.
- graph_colors: distinct observed chart/accent colors in a useful order.
- text_font: the dominant readable font, or null when no font is available.
Prefer observed foreground/background pairs and colors used across multiple slides.
""".strip()


def build_theme_profile(
    layouts: SlideLayouts,
    available_fonts: dict[str, str] | None = None,
) -> ThemeProfile:
    color_stats: dict[str, _ColorStats] = {}
    font_stats: dict[str, _FontStats] = {}
    pair_counts: dict[tuple[str, str], int] = {}

    for slide_index, layout in enumerate(layouts.layouts):
        slide_fill_candidates: list[tuple[str, float]] = []
        unpaired_text_colors: list[str] = []
        for component in layout.components:
            for element in component.model_dump(mode="json", exclude_none=True).get(
                "elements", []
            ):
                _collect_element_profile(
                    element,
                    slide_index=slide_index,
                    inherited_background=None,
                    color_stats=color_stats,
                    font_stats=font_stats,
                    pair_counts=pair_counts,
                    slide_fill_candidates=slide_fill_candidates,
                    unpaired_text_colors=unpaired_text_colors,
                )

        if slide_fill_candidates:
            slide_background = max(
                slide_fill_candidates,
                key=lambda item: (item[1], color_stats[item[0]].fill_count),
            )[0]
            for text_color in unpaired_text_colors:
                if text_color != slide_background:
                    pair_counts[(text_color, slide_background)] = (
                        pair_counts.get((text_color, slide_background), 0) + 1
                    )

    if not color_stats:
        for color in ("#FFFFFF", "#111111", "#2563EB", "#E5E7EB"):
            color_stats[color] = _ColorStats(hex=color)

    clustered_stats, raw_to_cluster = _cluster_colors(color_stats)
    profile_colors = []
    color_id_by_hex: dict[str, str] = {}
    for index, stats in enumerate(clustered_stats[:MAX_PROFILE_COLORS]):
        color_id = f"c{index}"
        color_id_by_hex[stats.hex] = color_id
        lightness, saturation = _hls(stats.hex)
        profile_colors.append(
            ProfileColor(
                id=color_id,
                hex=stats.hex,
                fill_count=stats.fill_count,
                fill_area=round(stats.fill_area, 3),
                text_count=stats.text_count,
                stroke_count=stats.stroke_count,
                chart_count=stats.chart_count,
                infographic_count=stats.infographic_count,
                slide_count=len(stats.slides),
                lightness=round(lightness, 3),
                saturation=round(saturation, 3),
            )
        )

    profile_pairs: list[ProfileColorPair] = []
    merged_pair_counts: dict[tuple[str, str], int] = {}
    for (foreground, background), count in pair_counts.items():
        foreground_hex = raw_to_cluster.get(foreground)
        background_hex = raw_to_cluster.get(background)
        foreground_id = color_id_by_hex.get(foreground_hex or "")
        background_id = color_id_by_hex.get(background_hex or "")
        if not foreground_id or not background_id or foreground_id == background_id:
            continue
        key = (foreground_id, background_id)
        merged_pair_counts[key] = merged_pair_counts.get(key, 0) + count

    colors_by_id = {color.id: color.hex for color in profile_colors}
    for (foreground_id, background_id), count in sorted(
        merged_pair_counts.items(), key=lambda item: (-item[1], item[0])
    )[:MAX_PROFILE_PAIRS]:
        profile_pairs.append(
            ProfileColorPair(
                foreground=foreground_id,
                background=background_id,
                count=count,
                contrast=round(
                    contrast_ratio(
                        colors_by_id[foreground_id], colors_by_id[background_id]
                    ),
                    2,
                ),
            )
        )

    return ThemeProfile(
        colors=profile_colors,
        color_pairs=profile_pairs,
        fonts=_build_profile_fonts(font_stats, available_fonts or {}),
    )


def generate_template_theme(
    layouts: SlideLayouts,
    available_fonts: dict[str, str] | None = None,
) -> PresentationThemeData:
    profile = build_theme_profile(layouts, available_fonts)
    try:
        selection = select_theme_roles_with_llm(profile)
    except Exception:
        LOGGER.exception(
            "[templates.v2.theme] LLM role selection failed; using deterministic roles"
        )
        selection = select_theme_roles_deterministically(profile)
    return materialize_theme(profile, selection)


def select_theme_roles_with_llm(profile: ThemeProfile) -> ThemeRoleSelection:
    from templates.v2.generation import _generate_with_validation_retries

    def validate_ids(selection: ThemeRoleSelection) -> None:
        color_ids = {color.id for color in profile.colors}
        font_ids = {font.id for font in profile.fonts}
        selected_colors = [
            selection.primary,
            selection.background,
            selection.card,
            selection.stroke,
            selection.background_text,
            selection.primary_text,
            *selection.graph_colors,
        ]
        invalid_colors = sorted(set(selected_colors) - color_ids)
        if invalid_colors:
            raise ValueError(f"unknown theme color IDs: {invalid_colors}")
        if selection.text_font is not None and selection.text_font not in font_ids:
            raise ValueError(f"unknown theme font ID: {selection.text_font}")

    prompt_profile = profile.model_dump(mode="json", exclude_none=True)
    for font in prompt_profile.get("fonts", []):
        font.pop("url", None)

    payload = _generate_with_validation_retries(
        client=get_client(config=get_llm_config()),
        model=get_model(),
        messages=[
            SystemMessage(content=THEME_ROLE_SYSTEM_PROMPT),
            UserMessage(
                content=json.dumps(prompt_profile, separators=(",", ":"))
            ),
        ],
        label="template semantic theme",
        output_model=ThemeRoleSelection,
        response_name="TemplateThemeRoleSelection",
        validation_retries=2,
        extra_validator=validate_ids,
        max_tokens=2000,
    )
    return ThemeRoleSelection.model_validate(payload)


def select_theme_roles_deterministically(
    profile: ThemeProfile,
) -> ThemeRoleSelection:
    colors = profile.colors
    background = max(
        colors,
        key=lambda color: (
            color.fill_area,
            color.slide_count,
            color.fill_count,
            -color.saturation,
        ),
    )
    non_background = [color for color in colors if color.id != background.id] or colors
    primary = max(
        non_background,
        key=lambda color: (
            color.chart_count + color.infographic_count,
            color.saturation,
            color.fill_count,
            color.slide_count,
        ),
    )
    card = max(
        non_background,
        key=lambda color: (color.fill_area, color.fill_count, -color.saturation),
    )
    stroke = max(
        non_background,
        key=lambda color: (color.stroke_count, color.fill_count),
    )
    graph_candidates = sorted(
        non_background,
        key=lambda color: (
            -(color.chart_count + color.infographic_count),
            -color.saturation,
            -color.fill_count,
            color.id,
        ),
    )
    return ThemeRoleSelection(
        primary=primary.id,
        background=background.id,
        card=card.id,
        stroke=stroke.id,
        background_text=_best_text_candidate(colors, background.hex).id,
        primary_text=_best_text_candidate(colors, primary.hex).id,
        graph_colors=[color.id for color in graph_candidates[:10]] or [primary.id],
        text_font=profile.fonts[0].id if profile.fonts else None,
    )


def materialize_theme(
    profile: ThemeProfile,
    selection: ThemeRoleSelection,
) -> PresentationThemeData:
    colors = {color.id: color.hex for color in profile.colors}
    fonts = {font.id: font for font in profile.fonts}

    primary = colors[selection.primary]
    background = colors[selection.background]
    card = colors[selection.card]
    stroke = colors[selection.stroke]
    background_text = _repair_text_color(
        colors[selection.background_text], background, profile.colors
    )
    primary_text = _repair_text_color(
        colors[selection.primary_text], primary, profile.colors
    )
    if _rgb_distance(card, background) < 10:
        card = _surface_variant(background, 0.06)
    if _rgb_distance(stroke, background) < 12:
        stroke = _surface_variant(background, 0.14)

    graph_colors = _complete_graph_colors(
        [colors[color_id] for color_id in selection.graph_colors], primary
    )
    selected_font = fonts.get(selection.text_font or "")
    if selected_font is None and profile.fonts:
        selected_font = profile.fonts[0]

    return PresentationThemeData(
        colors=PresentationThemeColors(
            primary=primary,
            background=background,
            card=card,
            stroke=stroke,
            background_text=background_text,
            primary_text=primary_text,
            **{f"graph_{index}": graph_colors[index] for index in range(10)},
        ),
        fonts=PresentationThemeFonts(
            textFont=PresentationThemeTextFont(
                name=selected_font.family if selected_font else "Inter",
                url=(selected_font.url or "") if selected_font else "",
            )
        ),
    )


def template_theme_for_presentation(
    *,
    template_id: str,
    template_name: str,
    template_description: str | None,
    theme: Any,
) -> dict[str, Any] | None:
    if not isinstance(theme, dict):
        return None
    return {
        "name": f"{template_name} Theme",
        "description": template_description or "Theme generated from the template",
        "data": json.loads(json.dumps(theme)),
        "source": "template",
        "template_id": template_id,
    }


def contrast_ratio(first: str, second: str) -> float:
    first_luminance = _relative_luminance(first)
    second_luminance = _relative_luminance(second)
    lighter = max(first_luminance, second_luminance)
    darker = min(first_luminance, second_luminance)
    return (lighter + 0.05) / (darker + 0.05)


def _collect_element_profile(
    element: dict[str, Any],
    *,
    slide_index: int,
    inherited_background: str | None,
    color_stats: dict[str, _ColorStats],
    font_stats: dict[str, _FontStats],
    pair_counts: dict[tuple[str, str], int],
    slide_fill_candidates: list[tuple[str, float]],
    unpaired_text_colors: list[str],
) -> None:
    element_type = str(element.get("type") or "")
    area = _normalized_element_area(element)
    own_fill = _color_from_style(element.get("fill"))
    if own_fill:
        _record_color(color_stats, own_fill, "fill", slide_index=slide_index, area=area)
        slide_fill_candidates.append((own_fill, area))
    effective_background = own_fill or inherited_background

    stroke = _color_from_style(element.get("stroke"))
    if stroke:
        _record_color(color_stats, stroke, "stroke", slide_index=slide_index)

    icon_color = _normalize_hex(element.get("color"))
    if icon_color:
        _record_color(color_stats, icon_color, "fill", slide_index=slide_index)

    text_colors: list[str] = []
    font = element.get("font")
    if isinstance(font, dict):
        color = _normalize_hex(font.get("color"))
        if color:
            text_colors.append(color)
        _record_font(font_stats, font)

    for embedded_font in _embedded_fonts(element):
        color = _normalize_hex(embedded_font.get("color"))
        if color:
            text_colors.append(color)
        _record_font(font_stats, embedded_font)

    for embedded_fill in _embedded_fills(element):
        _record_color(color_stats, embedded_fill, "fill", slide_index=slide_index)

    for text_color in text_colors:
        _record_color(color_stats, text_color, "text", slide_index=slide_index)
        if effective_background and text_color != effective_background:
            key = (text_color, effective_background)
            pair_counts[key] = pair_counts.get(key, 0) + 1
        else:
            unpaired_text_colors.append(text_color)

    element_colors = element.get("colors")
    if isinstance(element_colors, list):
        category = "infographic" if element_type == "infographic" else "chart"
        for value in element_colors:
            color = _normalize_hex(value)
            if color:
                _record_color(color_stats, color, category, slide_index=slide_index)

    named_color_categories = {
        "title_color": "text",
        "legend_color": "text",
        "axis_color": "stroke",
        "grid_color": "stroke",
    }
    for key, category in named_color_categories.items():
        color = _normalize_hex(element.get(key))
        if color:
            _record_color(color_stats, color, category, slide_index=slide_index)

    for child in _element_children(element):
        _collect_element_profile(
            child,
            slide_index=slide_index,
            inherited_background=effective_background,
            color_stats=color_stats,
            font_stats=font_stats,
            pair_counts=pair_counts,
            slide_fill_candidates=slide_fill_candidates,
            unpaired_text_colors=unpaired_text_colors,
        )


def _element_children(element: dict[str, Any]) -> list[dict[str, Any]]:
    children: list[dict[str, Any]] = []
    for key in ("children", "elements"):
        value = element.get(key)
        if isinstance(value, list):
            children.extend(child for child in value if isinstance(child, dict))
    for key in ("child", "item"):
        value = element.get(key)
        if isinstance(value, dict):
            children.append(value)
    return children


def _embedded_fonts(element: dict[str, Any]) -> list[dict[str, Any]]:
    fonts: list[dict[str, Any]] = []

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            font = value.get("font")
            if isinstance(font, dict):
                fonts.append(font)
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    for key in ("runs", "items", "columns", "rows"):
        visit(element.get(key))
    return fonts


def _embedded_fills(element: dict[str, Any]) -> list[str]:
    fills: list[str] = []

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            color = _color_from_style(value.get("color"))
            if color:
                fills.append(color)
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    for key in ("columns", "rows"):
        visit(element.get(key))
    return fills


def _record_color(
    color_stats: dict[str, _ColorStats],
    color: str,
    category: str,
    *,
    slide_index: int,
    area: float = 0.0,
) -> None:
    stats = color_stats.setdefault(color, _ColorStats(hex=color))
    stats.slides.add(slide_index)
    if category == "fill":
        stats.fill_count += 1
        stats.fill_area += max(0.0, min(area, 1.0))
    elif category == "text":
        stats.text_count += 1
    elif category == "stroke":
        stats.stroke_count += 1
    elif category == "chart":
        stats.chart_count += 1
    elif category == "infographic":
        stats.infographic_count += 1


def _record_font(font_stats: dict[str, _FontStats], font: dict[str, Any]) -> None:
    family = font.get("family")
    if not isinstance(family, str) or not family.strip():
        return
    normalized_family = family.strip()
    key = normalized_family.casefold()
    stats = font_stats.setdefault(key, _FontStats(family=normalized_family))
    stats.usage_count += 1
    size = font.get("size")
    if isinstance(size, (int, float)) and not isinstance(size, bool) and size > 0:
        stats.total_size += float(size)
        stats.sized_count += 1


def _build_profile_fonts(
    font_stats: dict[str, _FontStats], available_fonts: dict[str, str]
) -> list[ProfileFont]:
    available_by_name = {
        name.strip().casefold(): (name.strip(), url.strip())
        for name, url in available_fonts.items()
        if isinstance(name, str)
        and isinstance(url, str)
        and name.strip()
        and url.strip()
    }
    for key, (name, _) in available_by_name.items():
        font_stats.setdefault(key, _FontStats(family=name))

    ordered = sorted(
        font_stats.items(),
        key=lambda item: (-item[1].usage_count, item[1].family.casefold()),
    )[:MAX_PROFILE_FONTS]
    return [
        ProfileFont(
            id=f"f{index}",
            family=stats.family,
            usage_count=stats.usage_count,
            average_size=(
                round(stats.total_size / stats.sized_count, 1)
                if stats.sized_count
                else None
            ),
            url=available_by_name[key][1] if key in available_by_name else None,
        )
        for index, (key, stats) in enumerate(ordered)
    ]


def _cluster_colors(
    stats_by_color: dict[str, _ColorStats],
) -> tuple[list[_ColorStats], dict[str, str]]:
    ordered = sorted(
        stats_by_color.values(), key=lambda stats: (-stats.importance, stats.hex)
    )
    clusters: list[_ColorStats] = []
    raw_to_cluster: dict[str, str] = {}
    for stats in ordered:
        cluster = next(
            (
                candidate
                for candidate in clusters
                if _rgb_distance(candidate.hex, stats.hex) <= NEAR_COLOR_DISTANCE
            ),
            None,
        )
        if cluster is None:
            cluster = _ColorStats(hex=stats.hex)
            clusters.append(cluster)
        cluster.merge(stats)
        raw_to_cluster[stats.hex] = cluster.hex
    clusters.sort(key=lambda stats: (-stats.importance, stats.hex))
    return clusters, raw_to_cluster


def _best_text_candidate(
    colors: list[ProfileColor], background: str
) -> ProfileColor:
    accessible = [
        color for color in colors if contrast_ratio(color.hex, background) >= 4.5
    ]
    return max(
        accessible or colors,
        key=lambda color: (
            color.text_count,
            contrast_ratio(color.hex, background),
            color.slide_count,
        ),
    )


def _repair_text_color(
    selected: str, surface: str, candidates: list[ProfileColor]
) -> str:
    if contrast_ratio(selected, surface) >= 4.5:
        return selected
    observed = sorted(
        candidates,
        key=lambda color: (
            -color.text_count,
            -contrast_ratio(color.hex, surface),
        ),
    )
    for candidate in observed:
        if contrast_ratio(candidate.hex, surface) >= 4.5:
            return candidate.hex
    return max(("#000000", "#FFFFFF"), key=lambda color: contrast_ratio(color, surface))


def _complete_graph_colors(selected: list[str], primary: str) -> list[str]:
    colors: list[str] = []
    for color in [*selected, primary]:
        normalized = _normalize_hex(color)
        if normalized and normalized not in colors:
            colors.append(normalized)

    hue, lightness, saturation = colorsys.rgb_to_hls(
        *(channel / 255 for channel in _rgb(primary))
    )
    for index in range(1, 25):
        generated = _hex_from_rgb_float(
            colorsys.hls_to_rgb(
                (hue + index * 0.137) % 1.0,
                max(0.25, min(0.78, lightness + (0.10 if index % 2 else -0.08))),
                max(0.45, saturation),
            )
        )
        if generated not in colors:
            colors.append(generated)
        if len(colors) == 10:
            break
    return colors[:10]


def _surface_variant(color: str, distance: float) -> str:
    red, green, blue = _rgb(color)
    hue, lightness, saturation = colorsys.rgb_to_hls(red / 255, green / 255, blue / 255)
    target_lightness = (
        max(0.0, lightness - distance)
        if lightness > 0.55
        else min(1.0, lightness + distance)
    )
    return _hex_from_rgb_float(colorsys.hls_to_rgb(hue, target_lightness, saturation))


def _normalized_element_area(element: dict[str, Any]) -> float:
    size = element.get("size")
    if not isinstance(size, dict):
        return 0.0
    width = size.get("width")
    height = size.get("height")
    if not (
        isinstance(width, (int, float))
        and not isinstance(width, bool)
        and isinstance(height, (int, float))
        and not isinstance(height, bool)
    ):
        return 0.0
    return max(0.0, float(width) * float(height) / SLIDE_AREA)


def _color_from_style(value: Any) -> str | None:
    return _normalize_hex(value.get("color")) if isinstance(value, dict) else None


def _normalize_hex(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().lstrip("#")
    if len(normalized) == 3:
        normalized = "".join(character * 2 for character in normalized)
    if len(normalized) == 8:
        normalized = normalized[:6]
    if not re.fullmatch(r"[0-9a-fA-F]{6}", normalized):
        return None
    return f"#{normalized.upper()}"


def _rgb(color: str) -> tuple[int, int, int]:
    normalized = _normalize_hex(color)
    if not normalized:
        raise ValueError(f"invalid color: {color}")
    return (
        int(normalized[1:3], 16),
        int(normalized[3:5], 16),
        int(normalized[5:7], 16),
    )


def _rgb_distance(first: str, second: str) -> float:
    return math.sqrt(
        sum(
            (first_channel - second_channel) ** 2
            for first_channel, second_channel in zip(_rgb(first), _rgb(second))
        )
    )


def _hls(color: str) -> tuple[float, float]:
    red, green, blue = _rgb(color)
    _, lightness, saturation = colorsys.rgb_to_hls(red / 255, green / 255, blue / 255)
    return lightness, saturation


def _relative_luminance(color: str) -> float:
    channels = []
    for channel in _rgb(color):
        value = channel / 255
        channels.append(
            value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4
        )
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def _hex_from_rgb_float(rgb: tuple[float, float, float]) -> str:
    return "#{:02X}{:02X}{:02X}".format(
        *(round(max(0.0, min(1.0, channel)) * 255) for channel in rgb)
    )
