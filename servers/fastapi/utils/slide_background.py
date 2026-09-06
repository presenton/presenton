"""Дефолтные фоны слайдов из палитры шаблона.

Белые фоны выглядели дёшево: рендер дефолтил в #FFFFFF, темы шаблонов
(colors.background) до слайдов не доезжали, а в части шаблонов был зашит
full-bleed белый прямоугольник. Здесь собирается спокойный градиент из
палитры (фон + первичный цвет, лёгкий сдвиг угла по номеру слайда) и
вычищаются белые full-bleed прямоугольники, перекрывающие фон.
"""

from __future__ import annotations

import colorsys
import copy
from typing import Any

#: Полная ширина/высота канвы template-v2 — full-bleed определяется по ней.
SLIDE_CANVAS_WIDTH = 1280
SLIDE_CANVAS_HEIGHT = 720

#: Доля канвы, которую должен покрывать прямоугольник, чтобы считаться фоном.
_FULLBLEED_COVERAGE = 0.95

#: Цвета-кандидаты в «белый full-bleed фон», который выбрасывается.
_WHITE_FILL_CANDIDATES = {"#ffffff", "white", "#fff"}

#: Углы градиента — мягкое чередование, чтобы деки не выглядели штампованными.
_GRADIENT_ANGLES = (150, 135, 165, 120, 145, 160)


def _normalize_hex(color: str) -> str | None:
    value = str(color).strip().lower()
    if value.startswith("#"):
        value = value[1:]
    if len(value) == 3:
        value = "".join(char * 2 for char in value)
    if len(value) != 6:
        return None
    try:
        return f"#{value}"
    except ValueError:
        return None


def _hex_to_rgb(color: str) -> tuple[float, float, float]:
    value = _normalize_hex(color) or "#ffffff"
    return (
        int(value[1:3], 16) / 255,
        int(value[3:5], 16) / 255,
        int(value[5:7], 16) / 255,
    )


def _rgb_to_hex(rgb: tuple[float, float, float]) -> str:
    clamped = tuple(max(0, min(1, channel)) for channel in rgb)
    return (
        f"#{round(clamped[0] * 255):02x}{round(clamped[1] * 255):02x}{round(clamped[2] * 255):02x}"
    )


def mix_colors(base: str, other: str, weight: float) -> str:
    """Смешать цвета: weight — доля ``other`` (0..1)."""
    base_rgb = _hex_to_rgb(base)
    other_rgb = _hex_to_rgb(other)
    return _rgb_to_hex(
        tuple(base_rgb[index] * (1 - weight) + other_rgb[index] * weight for index in range(3))
    )


def _adjust_lightness(color: str, delta: float) -> str:
    hue, lightness, saturation = colorsys.rgb_to_hls(*_hex_to_rgb(color))
    return _rgb_to_hex(colorsys.hls_to_rgb(hue, max(0.0, min(1.0, lightness + delta)), saturation))


def is_light_color(color: str) -> bool:
    _, lightness, _ = colorsys.rgb_to_hls(*_hex_to_rgb(color))
    return lightness >= 0.7


def slide_background_gradient(
    background_color: str,
    primary_color: str | None = None,
    *,
    slide_index: int = 0,
) -> str:
    """CSS-градиент для слайда на основе палитры.

    Спокойный три-стоповый градиент: фон палитры с лёгким притопом
    первичного цвета к краю. Тёмные темы уводятся чуть глубже по светлоте,
    светлые — чуть светлее, чтобы «дорогой» отлив сохранялся на обоих.
    """
    base = _normalize_hex(background_color) or "#ffffff"
    primary = _normalize_hex(primary_color or "") or base
    angle = _GRADIENT_ANGLES[slide_index % len(_GRADIENT_ANGLES)]

    if is_light_color(base):
        # Светлая тема: едва заметный тёплый/холодный отлив первичного.
        stop1 = mix_colors(base, primary, 0.05)
        stop2 = _adjust_lightness(mix_colors(base, primary, 0.11), -0.02)
    else:
        # Тёмная тема: глубина за счёт затемнения, акцент первичным.
        stop1 = mix_colors(base, primary, 0.07)
        stop2 = _adjust_lightness(base, -0.05)

    return f"linear-gradient({angle}deg, {base} 0%, {stop1} 55%, {stop2} 100%)"


def _is_white_fullbleed_vector(element: Any) -> bool:
    if not isinstance(element, dict) or str(element.get("type")) != "vector":
        return False
    fill = element.get("fill")
    color = fill.get("color") if isinstance(fill, dict) else None
    if not isinstance(color, str) or color.strip().lower() not in _WHITE_FILL_CANDIDATES:
        return False
    opacity = fill.get("opacity") if isinstance(fill, dict) else None
    if opacity is not None and opacity < 0.5:
        return False
    points = element.get("points")
    if not isinstance(points, list) or len(points) < 3:
        return False
    xs: list[float] = []
    ys: list[float] = []
    for point in points:
        if not isinstance(point, dict):
            return False
        x = point.get("x")
        y = point.get("y")
        if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
            return False
        xs.append(float(x))
        ys.append(float(y))
    width = max(xs) - min(xs)
    height = max(ys) - min(ys)
    return (
        width >= SLIDE_CANVAS_WIDTH * _FULLBLEED_COVERAGE
        and height >= SLIDE_CANVAS_HEIGHT * _FULLBLEED_COVERAGE
        and min(xs) <= 1
        and min(ys) <= 1
    )


def strip_white_fullbleed_backgrounds(ui: dict) -> list[str]:
    """Убрать белые full-bleed прямоугольники из ui слайда; вернуть id/описания."""
    removed: list[str] = []

    def clean_elements(elements: Any) -> None:
        if not isinstance(elements, list):
            return
        for index, element in enumerate(elements):
            if _is_white_fullbleed_vector(element):
                removed.append(str(element.get("name") or element.get("id") or index))
                elements[index] = None

    elements = ui.get("elements")
    clean_elements(elements)
    if isinstance(elements, list):
        ui["elements"] = [item for item in elements if item is not None]
    for component in ui.get("components", []) or []:
        if not isinstance(component, dict):
            continue
        component_elements = component.get("elements")
        clean_elements(component_elements)
        if isinstance(component_elements, list):
            component["elements"] = [item for item in component_elements if item is not None]
    return removed


def resolve_slide_background_color(theme: Any) -> str | None:
    """Достать цвет фона палитры из theme-объекта презентации."""
    if not isinstance(theme, dict):
        return None
    data = theme.get("data")
    colors = data.get("colors") if isinstance(data, dict) else None
    if not isinstance(colors, dict):
        return None
    background = colors.get("background")
    if isinstance(background, str) and _normalize_hex(background):
        return _normalize_hex(background)
    return None


def resolve_slide_primary_color(theme: Any) -> str | None:
    """Достать первичный цвет палитры из theme-объекта презентации."""
    if not isinstance(theme, dict):
        return None
    data = theme.get("data")
    colors = data.get("colors") if isinstance(data, dict) else None
    if not isinstance(colors, dict):
        return None
    primary = colors.get("primary")
    if isinstance(primary, str) and _normalize_hex(primary):
        return _normalize_hex(primary)
    return None


def apply_slide_background(
    ui: dict[str, Any] | None,
    theme: Any,
    *,
    slide_index: int = 0,
) -> dict[str, Any] | None:
    """Применить палитровый фон к ui слайда (на месте, ui же и возвращается).

    Явно заданный в лейауте фон не трогаем; иначе — градиент из палитры
    и удаление белых full-bleed прямоугольников, которые его перекрыли бы.
    """
    if not isinstance(ui, dict):
        return ui

    explicit_background = ui.get("background")
    if isinstance(explicit_background, str) and explicit_background.strip():
        return ui

    background_color = resolve_slide_background_color(theme)
    if background_color is None:
        return ui

    ui["background"] = slide_background_gradient(
        background_color,
        resolve_slide_primary_color(theme),
        slide_index=slide_index,
    )
    strip_white_fullbleed_backgrounds(ui)
    return ui


def deep_copy_ui(ui: dict[str, Any] | None) -> dict[str, Any] | None:
    """Копия ui для мутации;None остаётся None."""
    return copy.deepcopy(ui) if isinstance(ui, dict) else None
