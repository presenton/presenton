from __future__ import annotations

import math
import random
from dataclasses import dataclass

from models.theme_data import GeneratedColorPalette

IS_DARK_BELOW = 0.65
BACKGROUND_RETRIES = 200
TEXT_RETRIES = 200

LIGHTNESS_VALUES: dict[str, float] = {
    "50": 0.97,
    "100": 0.93,
    "200": 0.86,
    "300": 0.78,
    "400": 0.70,
    "500": 0.62,
    "600": 0.54,
    "700": 0.46,
    "800": 0.38,
    "900": 0.30,
}


@dataclass(frozen=True)
class Oklch:
    l: float  # noqa: E741
    c: float
    h: float


def _clamp(value: float, min_value: float = 0.0, max_value: float = 1.0) -> float:
    return max(min_value, min(max_value, value))


def _get_random_value(min_value: float, max_value: float) -> float:
    return min_value + random.random() * (max_value - min_value)


def _get_random_value_at_min_max_distance(
    base_value: float,
    min_value: float,
    max_value: float,
    min_distance: float | None = None,
    max_distance: float | None = None,
) -> float:
    normalized_min_distance = max(0.0, min_distance or 0.0)
    normalized_max_distance = max_distance if max_distance is not None else math.inf
    min_dist = min(normalized_min_distance, normalized_max_distance)
    max_dist = max(normalized_min_distance, normalized_max_distance)

    lower_start = max(min_value, base_value - max_dist)
    lower_end = min(max_value, base_value - min_dist)
    upper_start = max(min_value, base_value + min_dist)
    upper_end = min(max_value, base_value + max_dist)

    lower_size = max(0.0, lower_end - lower_start)
    upper_size = max(0.0, upper_end - upper_start)
    total_size = lower_size + upper_size

    if total_size <= 0:
        return _get_random_value(min_value, max_value)

    picker = random.random() * total_size
    if picker < lower_size:
        return _get_random_value(lower_start, lower_end)

    return _get_random_value(upper_start, upper_end)


def _srgb_to_linear(channel: float) -> float:
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def _linear_to_srgb(channel: float) -> float:
    if channel <= 0.0031308:
        return 12.92 * channel
    return 1.055 * (channel ** (1 / 2.4)) - 0.055


def _oklch_to_srgb(color: Oklch) -> tuple[float, float, float]:
    hue_rad = math.radians(color.h % 360)
    a = color.c * math.cos(hue_rad)
    b = color.c * math.sin(hue_rad)

    l_ = (color.l + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (color.l - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (color.l - 0.0894841775 * a - 1.2914855480 * b) ** 3

    r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_
    g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_
    b = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_

    return (
        _clamp(_linear_to_srgb(r)),
        _clamp(_linear_to_srgb(g)),
        _clamp(_linear_to_srgb(b)),
    )


def _srgb_to_oklch(r: float, g: float, b: float) -> Oklch:
    r_lin = _srgb_to_linear(r)
    g_lin = _srgb_to_linear(g)
    b_lin = _srgb_to_linear(b)

    l_ = 0.4122214708 * r_lin + 0.5363325363 * g_lin + 0.0514459929 * b_lin
    m_ = 0.2119034982 * r_lin + 0.6806995451 * g_lin + 0.1073969566 * b_lin
    s_ = 0.0883024619 * r_lin + 0.2817188376 * g_lin + 0.6299787005 * b_lin

    l_cbrt = math.copysign(abs(l_) ** (1 / 3), l_)
    m_cbrt = math.copysign(abs(m_) ** (1 / 3), m_)
    s_cbrt = math.copysign(abs(s_) ** (1 / 3), s_)

    lightness = 0.2104542553 * l_cbrt + 0.7936177850 * m_cbrt - 0.0040720468 * s_cbrt
    a = 1.9779984951 * l_cbrt - 2.4285922050 * m_cbrt + 0.4505937099 * s_cbrt
    b = 0.0259040371 * l_cbrt + 0.7827717662 * m_cbrt - 0.8086757660 * s_cbrt

    chroma = math.hypot(a, b)
    hue = math.degrees(math.atan2(b, a)) % 360

    return Oklch(l=lightness, c=chroma, h=hue)


def _hex_to_oklch(hex_value: str) -> Oklch:
    hex_value = hex_value.strip().lstrip("#")
    if len(hex_value) != 6:
        raise ValueError(f"Invalid hex color: {hex_value!r}")
    r = int(hex_value[0:2], 16) / 255.0
    g = int(hex_value[2:4], 16) / 255.0
    b = int(hex_value[4:6], 16) / 255.0
    return _srgb_to_oklch(r, g, b)


def _format_hex(color: Oklch) -> str:
    r, g, b = _oklch_to_srgb(color)
    return f"#{int(round(r * 255)):02x}{int(round(g * 255)):02x}{int(round(b * 255)):02x}"


def _relative_luminance(color: Oklch) -> float:
    r, g, b = _oklch_to_srgb(color)
    r_lin = _srgb_to_linear(r)
    g_lin = _srgb_to_linear(g)
    b_lin = _srgb_to_linear(b)
    return 0.2126 * r_lin + 0.7152 * g_lin + 0.0722 * b_lin


def _wcag_contrast(a: Oklch, b: Oklch) -> float:
    l1 = _relative_luminance(a)
    l2 = _relative_luminance(b)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def _get_color_for_all_lightness_values(base_color: Oklch) -> dict[str, str]:
    colors: dict[str, str] = {}
    for name, value in LIGHTNESS_VALUES.items():
        color = Oklch(l=value, c=base_color.c, h=base_color.h)
        colors[name] = _format_hex(color)
    return colors


def _generate_primary_color() -> Oklch:
    lightness = _get_random_value(0.0, 1.0)
    chroma = _get_random_value(0.0, 0.4)
    hue = _get_random_value(0.0, 360.0)
    return Oklch(l=lightness, c=chroma, h=hue)


def _generate_background_color(base_color: Oklch) -> Oklch:
    for _ in range(BACKGROUND_RETRIES):
        lightness = _get_random_value(0.0, 1.0)
        chroma = _get_random_value(0.0, 0.4)
        hue = _get_random_value(0.0, 360.0)
        color = Oklch(l=lightness, c=chroma, h=hue)
        if _wcag_contrast(color, base_color) >= 6:
            return color

    if base_color.l < IS_DARK_BELOW:
        return Oklch(l=1.0, c=0.0, h=0.0)
    return Oklch(l=0.0, c=0.0, h=0.0)


def _generate_accent_color(base_color: Oklch, n: int) -> Oklch:
    lightness = _get_random_value_at_min_max_distance(base_color.l, 0.0, 1.0, 0.0, 0.1)
    chroma = _get_random_value_at_min_max_distance(base_color.c, 0.0, 0.4, 0.0, 0.4)
    hue = _get_random_value_at_min_max_distance(
        base_color.h if base_color.h is not None else 0.0,
        0.0,
        360.0,
        n * 90.0,
        (n + 1) * 90.0,
    )
    return Oklch(l=lightness, c=chroma, h=hue)


def _generate_text_color(base_color: Oklch, text_type: str) -> Oklch:
    is_base_dark = base_color.l < IS_DARK_BELOW

    for _ in range(TEXT_RETRIES):
        if text_type == "text_1":
            lightness = _get_random_value(0.8, 1.0) if is_base_dark else _get_random_value(0.0, 0.2)
            chroma = _get_random_value(0.0, 0.02)
        elif text_type == "text_2":
            lightness = _get_random_value(0.8, 1.0) if is_base_dark else _get_random_value(0.0, 0.2)
            chroma = _get_random_value(0.0, 0.04)
        else:
            raise ValueError(f"Invalid text type: {text_type}")

        hue = _get_random_value(0.0, 360.0)
        color = Oklch(l=lightness, c=chroma, h=hue)

        min_contrast = 6.0
        max_contrast = None
        contrast = _wcag_contrast(color, base_color)

        if contrast >= min_contrast and (max_contrast is None or contrast <= max_contrast):
            return color

    if base_color.l < IS_DARK_BELOW:
        return Oklch(l=1.0 if text_type == "text_1" else 0.9, c=0.0, h=0.0)
    return Oklch(l=0.0 if text_type == "text_1" else 0.1, c=0.0, h=0.0)


def get_lightness_key_at_distance(
    value: float,
    min_distance: int | None = None,
    max_distance: int | None = None,
    prefer_dark: bool | None = None,
) -> str:
    items = sorted(LIGHTNESS_VALUES.items(), key=lambda item: item[1])

    nearest_index = 0
    nearest_distance = abs(items[0][1] - value)
    for index, (_, lightness) in enumerate(items[1:], start=1):
        distance = abs(lightness - value)
        if distance < nearest_distance or (
            distance == nearest_distance and lightness < items[nearest_index][1]
        ):
            nearest_index = index
            nearest_distance = distance

    normalized_min = max(0, min_distance or 0)
    normalized_max = max_distance if max_distance is not None else normalized_min
    if normalized_max < normalized_min:
        normalized_min, normalized_max = normalized_max, normalized_min

    candidate_indices = []
    for distance in range(normalized_min, normalized_max + 1):
        lower_index = nearest_index - distance
        upper_index = nearest_index + distance
        if 0 <= lower_index < len(items):
            candidate_indices.append(lower_index)
        if upper_index != lower_index and 0 <= upper_index < len(items):
            candidate_indices.append(upper_index)

    if not candidate_indices:
        return items[nearest_index][0]

    if prefer_dark is True:
        darker_candidates = [idx for idx in candidate_indices if idx <= nearest_index]
        if darker_candidates:
            return items[min(darker_candidates)][0]
        return items[min(candidate_indices)][0]
    if prefer_dark is False:
        lighter_candidates = [idx for idx in candidate_indices if idx >= nearest_index]
        if lighter_candidates:
            return items[max(lighter_candidates)][0]
        return items[max(candidate_indices)][0]

    def distance_to_value(idx: int) -> float:
        return abs(items[idx][1] - value)

    closest_index = min(candidate_indices, key=lambda idx: (distance_to_value(idx), idx))
    return items[closest_index][0]


def generate_color_palette(
    provided_primary: str | None = None,
    provided_background: str | None = None,
    provided_accent_1: str | None = None,
    provided_accent_2: str | None = None,
    provided_text_1: str | None = None,
    provided_text_2: str | None = None,
) -> GeneratedColorPalette:
    primary = _hex_to_oklch(provided_primary) if provided_primary else _generate_primary_color()
    background = (
        _hex_to_oklch(provided_background)
        if provided_background
        else _generate_background_color(primary)
    )
    accent_1 = (
        _hex_to_oklch(provided_accent_1)
        if provided_accent_1
        else _generate_accent_color(primary, 1)
    )
    accent_2 = (
        _hex_to_oklch(provided_accent_2)
        if provided_accent_2
        else _generate_accent_color(primary, 2)
    )
    text_1 = (
        _hex_to_oklch(provided_text_1)
        if provided_text_1
        else _generate_text_color(background, "text_1")
    )
    text_2 = (
        _hex_to_oklch(provided_text_2)
        if provided_text_2
        else _generate_text_color(primary, "text_2")
    )

    primary_variations = _get_color_for_all_lightness_values(primary)
    background_variations = _get_color_for_all_lightness_values(background)
    accent_1_variations = _get_color_for_all_lightness_values(accent_1)
    accent_2_variations = _get_color_for_all_lightness_values(accent_2)

    return GeneratedColorPalette(
        primary=_format_hex(primary),
        background=_format_hex(background),
        accent_1=_format_hex(accent_1),
        accent_2=_format_hex(accent_2),
        text_1=_format_hex(text_1),
        text_2=_format_hex(text_2),
        primary_variations=primary_variations,
        background_variations=background_variations,
        accent_1_variations=accent_1_variations,
        accent_2_variations=accent_2_variations,
        primary_lightness=primary.l,
        background_lightness=background.l,
        accent_1_lightness=accent_1.l,
        accent_2_lightness=accent_2.l,
        text_1_lightness=text_1.l,
        text_2_lightness=text_2.l,
    )
