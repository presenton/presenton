"""Remap literal hex colors baked into a template's rendered `ui` tree
from one theme's role colors to another's, so switching themes actually
changes what renders (see theme_generate.theme_data_from_palette)."""

import copy
import re

COLOR_KEYS = frozenset(
    {
        "color",
        "title_color",
        "legend_color",
        "text_color",
        "axis_color",
        "grid_color",
        "background",
    }
)
ROLE_PRIORITY = (
    "primary",
    "background",
    "card",
    "stroke",
    "background_text",
    "primary_text",
    *[f"graph_{i}" for i in range(10)],
)

_SHORT_HEX_RE = re.compile(r"^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$")


def _normalize_hex(value: str) -> str:
    match = _SHORT_HEX_RE.match(value)
    if match:
        value = "#" + "".join(ch * 2 for ch in match.groups())
    return value.lower()


def build_color_map(source_colors: dict, target_colors: dict) -> dict[str, str]:
    color_map: dict[str, str] = {}
    for role in ROLE_PRIORITY:
        if role not in source_colors or role not in target_colors:
            continue
        source_hex = _normalize_hex(str(source_colors[role]))
        # ponytail: first-role-wins on hex collision; upgrade path is per-element role annotations in template.json
        if source_hex in color_map:
            continue
        color_map[source_hex] = target_colors[role]
    return color_map


def _map_value(value, color_map: dict[str, str]):
    if not isinstance(value, str):
        return value
    return color_map.get(_normalize_hex(value), value)


def _walk(node, color_map: dict[str, str]):
    if isinstance(node, dict):
        for key, value in node.items():
            if key in COLOR_KEYS and isinstance(value, str):
                node[key] = _map_value(value, color_map)
            elif key == "colors" and isinstance(value, list):
                node[key] = [_map_value(item, color_map) for item in value]
            else:
                _walk(value, color_map)
    elif isinstance(node, list):
        for item in node:
            _walk(item, color_map)


def recolor_ui(ui: dict, source_colors: dict, target_colors: dict) -> dict:
    color_map = build_color_map(source_colors, target_colors)
    result = copy.deepcopy(ui)
    _walk(result, color_map)
    return result
