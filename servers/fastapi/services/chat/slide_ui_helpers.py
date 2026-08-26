from __future__ import annotations

import copy
import json
import math
import re
from typing import Any

from utils.infographic_catalog import (
    INFOGRAPHIC_BY_TYPE,
    normalize_infographic_data,
)
from utils.latex_text import replace_text_runs, text_runs_to_tagged_text

_PATH_SEGMENT_RE = re.compile(r"^(?P<key>components|elements|children)\[(?P<index>\d+)\]$")
CONTENT_EDITABLE_ELEMENT_TYPES = {
    "text",
    "math",
    "text-list",
    "table",
    "image",
    "chart",
    "vector",
    "infographic",
}
VISIBLE_ELEMENT_TYPES = CONTENT_EDITABLE_ELEMENT_TYPES | {
    "container",
    "svg",
    "flex",
    "grid",
    "grid-view",
    "group",
}
REMOVED_GEOMETRY_ELEMENT_TYPES = {
    "circle",
    "ellipse",
    "line",
    "polygon",
    "rectangle",
    "vector_shape",
}
SUPPORTED_CHART_TYPES = {
    "area",
    "bar",
    "bubble",
    "donut",
    "horizontal_bar",
    "horizontal_stacked_bar",
    "line",
    "pie",
    "polar_area",
    "radar",
    "scatter",
    "stacked_bar",
}
DATA_LABEL_POSITIONS = {"base", "mid", "top", "outside"}
VECTOR_MARKERS = {
    "none",
    "arrow",
    "stealth",
    "triangle",
    "circle",
    "square",
    "diamond",
}
DEFAULT_CHART_COLORS = [
    "#7F22FE",
    "#155DFC",
    "#F59E0B",
    "#12B76A",
    "#EF4444",
    "#06B6D4",
    "#8B5CF6",
    "#64748B",
]
THEME_GRAPH_COLOR_KEYS = tuple(f"graph_{index}" for index in range(10))
CHART_UPDATE_KEYS = {
    "axis_color",
    "categories",
    "chart_type",
    "colors",
    "data_labels",
    "grid_color",
    "legend",
    "legend_color",
    "series",
    "title",
    "title_color",
    "x_axis",
    "x_axis_grid",
    "x_axis_title",
    "y_axis",
    "y_axis_grid",
    "y_axis_title",
}


def _normalize_chart_tree(node: Any, theme: dict[str, Any] | None = None) -> None:
    if isinstance(node, dict):
        if node.get("type") == "chart":
            _normalize_chart_element(node, theme)
        for value in node.values():
            _normalize_chart_tree(value, theme)
    elif isinstance(node, list):
        for value in node:
            _normalize_chart_tree(value, theme)


def _normalize_chart_element(
    element: dict[str, Any],
    theme: dict[str, Any] | None = None,
) -> None:
    element.pop("data_labels_color", None)
    element.pop("dataLabelsColor", None)
    element.pop("grid", None)
    if "title_color" not in element and "titleColor" in element:
        element["title_color"] = element.get("titleColor")
    if "legend_color" not in element and "legendColor" in element:
        element["legend_color"] = element.get("legendColor")

    chart_type = _normalize_chart_type(
        element.get("chart_type"),
        fallback=str(element.get("chart_type") or "bar"),
    )
    element["chart_type"] = chart_type

    legacy_data = _normalize_legacy_chart_data(element.get("data"))
    series = _normalize_chart_series(
        element.get("series"),
        fallback_name=str(element.get("title") or "Series 1"),
    )
    if not series and legacy_data:
        series = [
            {
                "name": str(element.get("title") or "Series 1"),
                "values": [item["value"] for item in legacy_data],
            }
        ]
    if not series:
        series = [{"name": "Series 1", "values": [0]}]

    legacy_categories = [item["label"] for item in legacy_data]
    categories = _normalize_chart_categories(
        element.get("categories") or legacy_categories,
        _max_chart_value_length(series),
    )
    _validate_chart_shape(chart_type, categories, series)
    category_count = max(1, len(categories), _max_chart_value_length(series))
    categories = _normalize_chart_categories(categories, category_count)
    for item in series:
        item["values"] = _pad_chart_values(
            item.get("values"),
            category_count,
        )

    if not _read_chart_colors(element.get("colors")):
        legacy_colors = [
            color
            for item in legacy_data
            if (color := _normalize_chart_color(item.get("color")))
        ]
        if legacy_colors:
            element["colors"] = legacy_colors

    color_count = _chart_color_target_count(chart_type, categories, series)
    colors = _resolve_chart_colors(
        element,
        theme=theme,
        count=color_count,
    )
    element["colors"] = colors
    element["color"] = colors[0]
    element["categories"] = categories
    element["series"] = series
    element["data"] = _chart_data_from_series(
        categories=categories,
        series=series,
        colors=colors,
        chart_type=chart_type,
    )

    theme_colors = _theme_colors(theme)
    if not _normalize_chart_color(element.get("axis_color")):
        element["axis_color"] = (
            _normalize_chart_color(theme_colors.get("background_text"))
            or _normalize_chart_color(theme_colors.get("primary"))
            or "#475467"
        )
    else:
        element["axis_color"] = _normalize_chart_color(element.get("axis_color"))
    if not _normalize_chart_color(element.get("grid_color")):
        element["grid_color"] = (
            _normalize_chart_color(theme_colors.get("stroke"))
            or _normalize_chart_color(theme_colors.get("card"))
            or "#D0D5DD"
        )
    else:
        element["grid_color"] = _normalize_chart_color(element.get("grid_color"))
    if _normalize_chart_color(element.get("title_color")):
        element["title_color"] = _normalize_chart_color(element.get("title_color"))
    if _normalize_chart_color(element.get("legend_color")):
        element["legend_color"] = _normalize_chart_color(element.get("legend_color"))

    if (
        "x_axis" not in element
        and chart_type not in {"pie", "donut", "polar_area", "radar"}
    ):
        element["x_axis"] = True
    if (
        "y_axis" not in element
        and chart_type not in {"pie", "donut", "polar_area", "radar"}
    ):
        element["y_axis"] = True
    if "x_axis_grid" not in element and chart_type not in {"pie", "donut"}:
        element["x_axis_grid"] = True
    if "y_axis_grid" not in element and chart_type not in {"pie", "donut"}:
        element["y_axis_grid"] = True
    if "legend" not in element:
        element["legend"] = chart_type in {"pie", "donut"} or len(series) > 1
    element["data_labels"] = _normalize_chart_data_labels(element.get("data_labels"))


def _apply_chart_content_update(
    element: dict[str, Any],
    chart: dict[str, Any],
    theme: dict[str, Any] | None = None,
) -> None:
    for source_key, target_key in (
        ("chart_type", "chart_type"),
        ("title", "title"),
        ("title_color", "title_color"),
        ("legend_color", "legend_color"),
        ("categories", "categories"),
        ("series", "series"),
        ("colors", "colors"),
        ("axis_color", "axis_color"),
        ("grid_color", "grid_color"),
        ("x_axis_title", "x_axis_title"),
        ("y_axis_title", "y_axis_title"),
    ):
        if source_key in chart:
            element[target_key] = copy.deepcopy(chart[source_key])

    for source_key, target_key in (
        ("x_axis", "x_axis"),
        ("y_axis", "y_axis"),
        ("x_axis_grid", "x_axis_grid"),
        ("y_axis_grid", "y_axis_grid"),
        ("data_labels", "data_labels"),
        ("legend", "legend"),
    ):
        if source_key in chart:
            element[target_key] = chart[source_key]

    _normalize_chart_element(element, theme)


def _normalize_chart_data_labels(value: Any) -> str | None:
    if value is True:
        return "top"
    if value is False or value is None:
        return None
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in DATA_LABEL_POSITIONS:
            return normalized
    return None


def _validate_visual_insert_tree(node: Any) -> None:
    if isinstance(node, dict):
        _validate_current_element_model(node)
        if node.get("type") == "chart" and not _chart_element_has_explicit_data(node):
            raise ValueError(
                "Chart elements must include numeric data via series.values or "
                "data before they can be added."
            )
        if node.get("type") == "table" and not _table_element_has_explicit_data(node):
            raise ValueError(
                "Table elements must include headers/columns and rows before "
                "they can be added."
            )
        if node.get("type") == "image" and not _image_element_has_explicit_data(node):
            raise ValueError(
                "Image elements must include an image/icon URL in data before "
                "they can be added."
            )
        for value in node.values():
            _validate_visual_insert_tree(value)
    elif isinstance(node, list):
        for value in node:
            _validate_visual_insert_tree(value)


def _validate_chart_insert_tree(node: Any) -> None:
    _validate_visual_insert_tree(node)


def _validate_current_element_model(element: dict[str, Any]) -> None:
    element_type = element.get("type")
    if element_type in REMOVED_GEOMETRY_ELEMENT_TYPES:
        raise ValueError(
            f"Element type '{element_type}' was removed. Use type='vector' with "
            "points, shape='ellipse' for circles/ellipses or shape='polygon' for "
            "other shapes, and closed=false for lines."
        )
    if element_type == "vector":
        _validate_vector_element(element)
    if element_type == "infographic":
        _validate_infographic_element(element)


def _validate_vector_element(element: dict[str, Any]) -> None:
    points = element.get("points")
    if not isinstance(points, list) or len(points) < 2:
        raise ValueError("Vector elements require at least two numeric points.")
    for point in points:
        if not isinstance(point, dict) or not all(
            isinstance(point.get(axis), (int, float)) for axis in ("x", "y")
        ):
            raise ValueError("Each vector point must contain numeric x and y values.")

    shape = element.get("shape")
    if shape is not None and shape not in {"polygon", "ellipse"}:
        raise ValueError("vector.shape must be 'polygon' or 'ellipse'.")
    curve = element.get("curve")
    if curve is not None and (
        not isinstance(curve, dict) or curve.get("type") != "smooth"
    ):
        raise ValueError("vector.curve supports only type='smooth'.")
    corner_radii = element.get("corner_radii")
    if isinstance(corner_radii, list) and len(corner_radii) != len(points):
        raise ValueError("vector.corner_radii must match the number of points.")
    for field in ("start_marker", "end_marker"):
        marker = element.get(field)
        if marker is not None and marker not in VECTOR_MARKERS:
            raise ValueError(
                f"vector.{field} must be a supported line endpoint marker."
            )


def _validate_infographic_element(element: dict[str, Any]) -> None:
    data = element.get("data")
    if not isinstance(data, dict):
        raise ValueError("Infographic elements require a nested data object.")
    infographic_type = data.get("type")
    if not isinstance(infographic_type, str) or infographic_type not in INFOGRAPHIC_BY_TYPE:
        supported = ", ".join(INFOGRAPHIC_BY_TYPE)
        raise ValueError(
            f"infographic.data.type must be a supported infographic type: {supported}."
        )

    element["data"] = normalize_infographic_data(infographic_type, data)  # type: ignore[arg-type]
    colors = element.get("colors")
    if colors is not None and (
        not isinstance(colors, list)
        or not colors
        or not all(isinstance(color, str) and color.strip() for color in colors)
    ):
        raise ValueError("infographic.colors must be a non-empty string array.")


def _chart_element_has_explicit_data(element: dict[str, Any]) -> bool:
    return bool(
        _normalize_chart_series(
            element.get("series"),
            fallback_name=str(element.get("title") or "Series 1"),
        )
        or _normalize_legacy_chart_data(element.get("data"))
    )


def _table_element_has_explicit_data(element: dict[str, Any]) -> bool:
    columns = element.get("columns")
    headers = element.get("headers")
    rows = element.get("rows")
    has_columns = isinstance(columns, list) and len(columns) > 0
    has_headers = isinstance(headers, list) and len(headers) > 0
    has_rows = isinstance(rows, list) and len(rows) > 0
    return (has_columns or has_headers) and has_rows


def _image_element_has_explicit_data(element: dict[str, Any]) -> bool:
    asset_url = _template_asset_url(element)
    return bool(asset_url and _looks_like_asset_reference(asset_url))


def _normalize_image_tree(node: Any) -> None:
    if isinstance(node, dict):
        if node.get("type") == "image":
            _normalize_image_element(node)
        for value in node.values():
            _normalize_image_tree(value)
    elif isinstance(node, list):
        for value in node:
            _normalize_image_tree(value)


def _normalize_image_element(element: dict[str, Any]) -> None:
    asset_url = _template_asset_url(element)
    if asset_url and _looks_like_asset_reference(asset_url):
        element["data"] = asset_url
    element.setdefault("is_icon", False)
    prompt = _template_asset_prompt(
        element,
        is_icon=element.get("is_icon") is True,
    )
    if prompt:
        element.setdefault("prompt", prompt)


def _normalize_generated_image_fit(
    element: dict[str, Any],
    asset_url: str | None,
) -> None:
    if element.get("is_icon") is True or element.get("fit") == "cover":
        return
    if _has_image_clip_path(element):
        return
    if _looks_like_svg_asset_reference(asset_url):
        return
    element["fit"] = "cover"


def _has_image_clip_path(element: dict[str, Any]) -> bool:
    for key in ("clip_path", "clipPath", "clippath"):
        value = element.get(key)
        if isinstance(value, str) and value.strip() and value.strip().lower() != "none":
            return True
    return False


def _looks_like_svg_asset_reference(value: str | None) -> bool:
    if not isinstance(value, str):
        return False
    normalized = value.strip().lower()
    if normalized.startswith("data:image/svg+xml"):
        return True
    return normalized.split("?", 1)[0].split("#", 1)[0].endswith(".svg")


def _normalize_chart_type(value: Any, *, fallback: str = "bar") -> str:
    raw = value if isinstance(value, str) else fallback
    normalized = raw.strip().lower()
    return normalized if normalized in SUPPORTED_CHART_TYPES else "bar"


def _normalize_chart_series(
    value: Any,
    *,
    fallback_name: str,
) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []

    series: list[dict[str, Any]] = []
    for index, item in enumerate(value[:20]):
        if isinstance(item, dict):
            raw_values = item.get("values")
            if not isinstance(raw_values, list):
                raw_values = item.get("data")
            if not isinstance(raw_values, list):
                continue
            name = item.get("name")
            series_name = (
                str(name).strip()
                if isinstance(name, str) and name.strip()
                else fallback_name
                if index == 0 and fallback_name
                else f"Series {index + 1}"
            )
        elif isinstance(item, list):
            raw_values = item
            series_name = (
                fallback_name
                if index == 0 and fallback_name
                else f"Series {index + 1}"
            )
        else:
            continue

        values = [
            number
            for raw_value in raw_values[:100]
            if (number := _chart_number(raw_value)) is not None
        ]
        if values:
            series.append({"name": series_name, "values": values})
    return series


def _chart_number(value: Any) -> float | int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        number = float(value)
        return int(number) if number.is_integer() else number
    if isinstance(value, str):
        match = re.search(
            r"[-+]?(?:\d[\d,]*(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?",
            value.strip(),
        )
        if not match:
            return None
        try:
            number = float(match.group(0).replace(",", ""))
        except ValueError:
            return None
        if math.isfinite(number):
            return int(number) if number.is_integer() else number
    return None


def _normalize_legacy_chart_data(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []

    rows: list[dict[str, Any]] = []
    for item in value[:100]:
        direct_number = _chart_number(item)
        if direct_number is not None:
            rows.append({"label": "", "value": direct_number})
            continue

        if not isinstance(item, dict):
            continue
        number = _first_chart_number(item.get("value"), item.get("data"), item.get("y"))
        if number is None:
            continue

        row: dict[str, Any] = {
            "label": _first_chart_label(
                item.get("label"),
                item.get("name"),
                item.get("category"),
                item.get("x"),
            ),
            "value": number,
        }
        color = _normalize_chart_color(item.get("color"))
        if color:
            row["color"] = color
        rows.append(row)
    return rows


def _first_chart_number(*values: Any) -> float | int | None:
    for value in values:
        number = _chart_number(value)
        if number is not None:
            return number
    return None


def _first_chart_label(*values: Any) -> str:
    for value in values:
        if value is None:
            continue
        label = str(value).strip()
        if label:
            return label
    return ""


def _normalize_chart_categories(
    value: Any,
    length: int,
) -> list[str]:
    raw_values = value if isinstance(value, list) and value else []
    target_length = max(1, length, len(raw_values))
    return [
        str(raw_values[index]).strip()
        if index < len(raw_values) and str(raw_values[index]).strip()
        else f"Item {index + 1}"
        for index in range(target_length)
    ]


def _max_chart_value_length(series: list[dict[str, Any]]) -> int:
    return max(
        0,
        *[
            len(item.get("values"))
            for item in series
            if isinstance(item.get("values"), list)
        ],
    )


def _validate_chart_shape(
    chart_type: str,
    categories: list[str],
    series: list[dict[str, Any]],
) -> None:
    if chart_type in {"pie", "donut"} and len(series) > 1:
        raise ValueError("Pie and donut charts support exactly one series.")
    if not categories:
        return
    category_count = len(categories)
    for item in series:
        values = item.get("values")
        if isinstance(values, list) and len(values) != category_count:
            raise ValueError("Each chart series must match the category count.")


def _pad_chart_values(value: Any, length: int) -> list[Any]:
    values = value if isinstance(value, list) else []
    padded = values[:length]
    while len(padded) < length:
        padded.append(0)
    return padded


def _resolve_chart_colors(
    element: dict[str, Any],
    *,
    theme: dict[str, Any] | None,
    count: int,
) -> list[str]:
    source_colors = _read_chart_colors(element.get("colors"))
    if not source_colors:
        source_colors = _theme_chart_palette(theme)
    if not source_colors:
        source_colors = [
            _normalize_chart_color(element.get("color")) or DEFAULT_CHART_COLORS[0]
        ]

    target_count = min(12, max(1, count, len(source_colors)))
    return [
        source_colors[index % len(source_colors)]
        for index in range(target_count)
    ]


def _read_chart_colors(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    colors = [_normalize_chart_color(item) for item in value]
    return [color for color in colors if color]


def _chart_color_target_count(
    chart_type: str,
    categories: list[str],
    series: list[dict[str, Any]],
) -> int:
    if chart_type not in {"pie", "donut"} and len(series) > 1:
        return len(series)
    return len(categories)


def _chart_data_from_series(
    *,
    categories: list[str],
    series: list[dict[str, Any]],
    colors: list[str],
    chart_type: str,
) -> list[dict[str, Any]]:
    first = series[0] if series else {"values": [0]}
    values = first.get("values") if isinstance(first.get("values"), list) else [0]
    category_colors = chart_type in {"pie", "donut"} or len(series) == 1
    return [
        {
            "label": (
                categories[index] if index < len(categories) else f"Item {index + 1}"
            ),
            "value": _chart_number(values[index] if index < len(values) else 0) or 0,
            "color": colors[index % len(colors)] if category_colors else colors[0],
        }
        for index in range(min(8, max(len(categories), len(values), 1)))
    ]


def _theme_chart_palette(theme: dict[str, Any] | None) -> list[str]:
    colors = _theme_colors(theme)
    palette = [
        color
        for color in (
            _normalize_chart_color(colors.get(key)) for key in THEME_GRAPH_COLOR_KEYS
        )
        if color
    ]
    if palette:
        return palette
    fallback_keys = ("primary", "card", "stroke", "background_text", "primary_text")
    return [
        color
        for color in (_normalize_chart_color(colors.get(key)) for key in fallback_keys)
        if color
    ]


def _theme_colors(theme: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(theme, dict):
        return {}
    data = theme.get("data")
    if isinstance(data, dict):
        colors = data.get("colors")
        if isinstance(colors, dict):
            return colors
    colors = theme.get("colors")
    return colors if isinstance(colors, dict) else {}


def _normalize_chart_color(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    color = value.strip()
    if not color:
        return None
    hex_match = re.match(r"^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", color)
    if hex_match:
        raw = hex_match.group(1)
        if len(raw) == 3:
            raw = "".join(char + char for char in raw)
        return f"#{raw.upper()}"
    if re.match(r"^rgba?\([^)]+\)$", color, re.IGNORECASE):
        return color
    return color


def _model_dict(value: Any) -> dict[str, Any]:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json", exclude_none=True)
    return json.loads(json.dumps(value, ensure_ascii=False))


def _ungrouped_components_from_component(
    component: dict[str, Any],
    component_index: int,
    *,
    used_ids: set[str],
) -> list[dict[str, Any]]:
    component_box = _required_component_box(component)
    id_base = _normalize_component_id(
        str(
            component.get("id")
            or component.get("name")
            or component.get("description")
            or f"component_{component_index + 1}"
        )
    )
    entries: list[dict[str, Any]] = []
    elements = component.get("elements")
    if not isinstance(elements, list):
        return []

    valid_elements = [element for element in elements if isinstance(element, dict)]
    if len(valid_elements) == 1:
        element = valid_elements[0]
        box = _box_or_default(
            element,
            {
                "x": 0.0,
                "y": 0.0,
                "width": component_box["width"],
                "height": component_box["height"],
            },
        )
        entries.extend(
            _ungroup_element_one_level(
                element,
                {
                    "x": component_box["x"] + box["x"],
                    "y": component_box["y"] + box["y"],
                    "width": box["width"],
                    "height": box["height"],
                },
            )
        )
    else:
        for element in valid_elements:
            box = _box_or_default(
                element,
                {
                    "x": 0.0,
                    "y": 0.0,
                    "width": component_box["width"],
                    "height": component_box["height"],
                },
            )
            entries.append(
                {
                    "element": element,
                    "box": {
                        "x": component_box["x"] + box["x"],
                        "y": component_box["y"] + box["y"],
                        "width": box["width"],
                        "height": box["height"],
                    },
                }
            )

    parts: list[dict[str, Any]] = []
    for index, entry in enumerate(entries):
        box = entry["box"]
        element = copy.deepcopy(entry["element"])
        _normalize_ungrouped_element_frame(element, box)
        component_id = _unique_component_id(f"{id_base}_part_{index + 1}", used_ids)
        parts.append(
            {
                "id": component_id,
                "description": "Ungrouped component element",
                "position": {"x": box["x"], "y": box["y"]},
                "elements": [element],
            }
        )
    return parts


def _ungroup_element_one_level(
    element: dict[str, Any],
    box: dict[str, float],
) -> list[dict[str, Any]]:
    children = _child_items(element)
    if not children:
        return []

    entries = []
    for child, child_box in _layout_child_boxes(element, children, box):
        entries.append(
            {
                "element": child,
                "box": {
                    "x": box["x"] + child_box["x"],
                    "y": box["y"] + child_box["y"],
                    "width": child_box["width"],
                    "height": child_box["height"],
                },
            }
        )
    return entries


def _child_items(element: dict[str, Any]) -> list[dict[str, Any]]:
    for key in ("children", "elements"):
        value = element.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    child = element.get("child")
    return [child] if isinstance(child, dict) else []


def _layout_child_boxes(
    parent: dict[str, Any],
    children: list[dict[str, Any]],
    parent_box: dict[str, float],
) -> list[tuple[dict[str, Any], dict[str, float]]]:
    parent_type = str(parent.get("type") or "")
    if parent_type in {"flex", "list-view"}:
        return _layout_flex_child_boxes(parent, children, parent_box)
    if parent_type in {"grid", "grid-view"}:
        return _layout_grid_child_boxes(parent, children, parent_box)

    padding = _padding(parent.get("padding")) if parent_type == "container" else {}
    content = {
        "x": float(padding.get("left", 0.0)),
        "y": float(padding.get("top", 0.0)),
        "width": max(
            1.0,
            parent_box["width"]
            - float(padding.get("left", 0.0))
            - float(padding.get("right", 0.0)),
        ),
        "height": max(
            1.0,
            parent_box["height"]
            - float(padding.get("top", 0.0))
            - float(padding.get("bottom", 0.0)),
        ),
    }
    return [
        (
            child,
            _box_or_default(
                child,
                {
                    "x": content["x"],
                    "y": content["y"],
                    "width": content["width"],
                    "height": content["height"],
                },
            ),
        )
        for child in children
    ]


def _layout_flex_child_boxes(
    parent: dict[str, Any],
    children: list[dict[str, Any]],
    parent_box: dict[str, float],
) -> list[tuple[dict[str, Any], dict[str, float]]]:
    padding = _padding(parent.get("padding"))
    direction = "row" if parent.get("direction") == "row" else "column"
    gap = _number(parent.get("gap")) or 0.0
    content_x = padding["left"]
    content_y = padding["top"]
    content_w = max(1.0, parent_box["width"] - padding["left"] - padding["right"])
    content_h = max(1.0, parent_box["height"] - padding["top"] - padding["bottom"])
    count = max(1, len(children))
    if direction == "row":
        width = max(1.0, (content_w - gap * (count - 1)) / count)
        return [
            (
                child,
                _box_or_default(
                    child,
                    {
                        "x": content_x + index * (width + gap),
                        "y": content_y,
                        "width": width,
                        "height": content_h,
                    },
                ),
            )
            for index, child in enumerate(children)
        ]
    height = max(1.0, (content_h - gap * (count - 1)) / count)
    return [
        (
            child,
            _box_or_default(
                child,
                {
                    "x": content_x,
                    "y": content_y + index * (height + gap),
                    "width": content_w,
                    "height": height,
                },
            ),
        )
        for index, child in enumerate(children)
    ]


def _layout_grid_child_boxes(
    parent: dict[str, Any],
    children: list[dict[str, Any]],
    parent_box: dict[str, float],
) -> list[tuple[dict[str, Any], dict[str, float]]]:
    padding = _padding(parent.get("padding"))
    gap = _number(parent.get("gap")) or 0.0
    column_gap = _number(parent.get("column_gap"))
    row_gap = _number(parent.get("row_gap"))
    column_gap = gap if column_gap is None else column_gap
    row_gap = gap if row_gap is None else row_gap
    column_count = _number(parent.get("columns"))
    if column_count is None and isinstance(parent.get("columns"), list):
        column_count = len(parent["columns"])
    columns = max(1, int(column_count or 1))
    rows = max(1, math.ceil(len(children) / columns))
    content_w = max(1.0, parent_box["width"] - padding["left"] - padding["right"])
    content_h = max(1.0, parent_box["height"] - padding["top"] - padding["bottom"])
    cell_w = max(1.0, (content_w - column_gap * (columns - 1)) / columns)
    cell_h = max(1.0, (content_h - row_gap * (rows - 1)) / rows)

    child_sizes = [_element_size_or_default(child, cell_w, cell_h) for child in children]
    column_widths = [cell_w for _ in range(columns)]
    row_heights = [cell_h for _ in range(rows)]
    for index, child_size in enumerate(child_sizes):
        column_index = index % columns
        row_index = index // columns
        column_widths[column_index] = max(column_widths[column_index], child_size["width"])
        row_heights[row_index] = max(row_heights[row_index], child_size["height"])

    column_offsets = [padding["left"]]
    for index in range(1, columns):
        column_offsets.append(column_offsets[index - 1] + column_widths[index - 1] + column_gap)
    row_offsets = [padding["top"]]
    for index in range(1, rows):
        row_offsets.append(row_offsets[index - 1] + row_heights[index - 1] + row_gap)

    return [
        (
            child,
            _box_or_default(
                child,
                {
                    "x": column_offsets[index % columns],
                    "y": row_offsets[index // columns],
                    "width": child_sizes[index]["width"],
                    "height": child_sizes[index]["height"],
                },
            ),
        )
        for index, child in enumerate(children)
    ]


def _element_size_or_default(
    element: dict[str, Any],
    default_width: float,
    default_height: float,
) -> dict[str, float]:
    size = element.get("size")
    width = _finite_number(size.get("width")) if isinstance(size, dict) else None
    height = _finite_number(size.get("height")) if isinstance(size, dict) else None
    return {
        "width": width if width is not None and width > 0 else default_width,
        "height": height if height is not None and height > 0 else default_height,
    }


def _required_component_box(value: dict[str, Any]) -> dict[str, float]:
    box = _component_box(value)
    if box is None:
        raise ValueError("Cannot safely ungroup component without position and elements.")
    return box


def _box_or_default(
    value: dict[str, Any],
    default: dict[str, float],
) -> dict[str, float]:
    vector_box = _vector_box(value)
    if vector_box is not None:
        return vector_box
    position = value.get("position")
    size = value.get("size")
    x = _finite_number(position.get("x")) if isinstance(position, dict) else None
    y = _finite_number(position.get("y")) if isinstance(position, dict) else None
    width = _finite_number(size.get("width")) if isinstance(size, dict) else None
    height = _finite_number(size.get("height")) if isinstance(size, dict) else None
    return {
        "x": x if x is not None else default["x"],
        "y": y if y is not None else default["y"],
        "width": width if width is not None and width > 0 else default["width"],
        "height": height if height is not None and height > 0 else default["height"],
    }


def _component_box(value: dict[str, Any]) -> dict[str, float] | None:
    position = value.get("position")
    if not isinstance(position, dict):
        return None
    x = _finite_number(position.get("x"))
    y = _finite_number(position.get("y"))
    content_size = _component_content_size(value)
    if x is None or y is None or content_size is None:
        return None
    return {
        "x": x,
        "y": y,
        "width": content_size["width"],
        "height": content_size["height"],
    }


def _component_content_size(value: dict[str, Any]) -> dict[str, float] | None:
    elements = value.get("elements")
    if not isinstance(elements, list):
        return None
    width = 1.0
    height = 1.0
    has_element = False
    for element in elements:
        if not isinstance(element, dict):
            continue
        box = _optional_box(element)
        if box is None:
            continue
        has_element = True
        width = max(width, box["x"] + box["width"])
        height = max(height, box["y"] + box["height"])
    if not has_element:
        return None
    return {"width": width, "height": height}


def _optional_box(value: dict[str, Any]) -> dict[str, float] | None:
    vector_box = _vector_box(value)
    if vector_box is not None:
        return vector_box
    position = value.get("position")
    size = value.get("size")
    if not isinstance(position, dict) or not isinstance(size, dict):
        return None
    x = _finite_number(position.get("x"))
    y = _finite_number(position.get("y"))
    width = _finite_number(size.get("width"))
    height = _finite_number(size.get("height"))
    if x is None or y is None or width is None or height is None:
        return None
    if width <= 0 or height <= 0:
        return None
    return {"x": x, "y": y, "width": width, "height": height}


def _normalize_ungrouped_element_frame(
    element: dict[str, Any],
    box: dict[str, float],
) -> None:
    if str(element.get("type") or "").lower() == "vector":
        vector_box = _vector_box(element)
        if vector_box is not None:
            _translate_vector_points(element, -vector_box["x"], -vector_box["y"])
        element.pop("size", None)
        element["position"] = {"x": 0, "y": 0}
        return

    element["position"] = {"x": 0, "y": 0}
    element["size"] = {"width": box["width"], "height": box["height"]}


def _vector_box(value: dict[str, Any]) -> dict[str, float] | None:
    if str(value.get("type") or "").lower() != "vector":
        return None
    points = value.get("points")
    if not isinstance(points, list):
        return None
    parsed: list[tuple[float, float]] = []
    for point in points:
        if not isinstance(point, dict):
            continue
        x = _finite_number(point.get("x"))
        y = _finite_number(point.get("y"))
        if x is not None and y is not None:
            parsed.append((x, y))
    if not parsed:
        return None
    min_x = min(point[0] for point in parsed)
    min_y = min(point[1] for point in parsed)
    max_x = max(point[0] for point in parsed)
    max_y = max(point[1] for point in parsed)
    stroke = value.get("stroke")
    stroke_width = 1.0
    if isinstance(stroke, dict):
        stroke_value = _finite_number(stroke.get("width"))
        if stroke_value is not None:
            stroke_width = max(0.0, stroke_value)
    return {
        "x": min_x,
        "y": min_y,
        "width": max(max_x - min_x, stroke_width, 1.0),
        "height": max(max_y - min_y, stroke_width, 1.0),
    }


def _translate_vector_points(element: dict[str, Any], dx: float, dy: float) -> None:
    points = element.get("points")
    if not isinstance(points, list):
        return
    next_points = []
    for point in points:
        if not isinstance(point, dict):
            next_points.append(point)
            continue
        x = _finite_number(point.get("x"))
        y = _finite_number(point.get("y"))
        if x is None or y is None:
            next_points.append(point)
            continue
        next_points.append({**point, "x": x + dx, "y": y + dy})
    element["points"] = next_points


def _finite_number(value: Any) -> float | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        number = float(value)
        return number if math.isfinite(number) else None
    return None


def _number(value: Any) -> float | None:
    return _finite_number(value)


def _padding(value: Any) -> dict[str, float]:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        number = float(value)
        return {"top": number, "right": number, "bottom": number, "left": number}
    if not isinstance(value, dict):
        return {"top": 0.0, "right": 0.0, "bottom": 0.0, "left": 0.0}
    x = _number(value.get("x")) or _number(value.get("horizontal")) or 0.0
    y = _number(value.get("y")) or _number(value.get("vertical")) or 0.0
    return {
        "top": _number(value.get("top")) or y,
        "right": _number(value.get("right")) or x,
        "bottom": _number(value.get("bottom")) or y,
        "left": _number(value.get("left")) or x,
    }


def _normalize_component_id(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")
    return normalized or "component"


def _unique_component_id(base: str, used_ids: set[str]) -> str:
    stem = base[:80].strip("_") or "component"
    candidate = stem
    suffix = 2
    while candidate in used_ids:
        suffix_text = f"_{suffix}"
        candidate = f"{stem[: 80 - len(suffix_text)]}{suffix_text}"
        suffix += 1
    used_ids.add(candidate)
    return candidate


def _compact_components(layout_dict: dict[str, Any]) -> list[dict[str, Any]]:
    components: list[dict[str, Any]] = []
    for component in layout_dict.get("components", []):
        if not isinstance(component, dict):
            continue
        components.append(
            {
                "component_id": component.get("id"),
                "description": component.get("description"),
                "element_count": len(component.get("elements", []))
                if isinstance(component.get("elements"), list)
                else 0,
                "element_types": [
                    element.get("type")
                    for element in component.get("elements", [])
                    if isinstance(element, dict)
                ],
            }
        )
    return components


def _collect_editable_elements(
    layout_dict: dict[str, Any],
    *,
    include_visual_elements: bool = False,
) -> list[dict[str, Any]]:
    editable: list[dict[str, Any]] = []
    root_elements = layout_dict.get("elements")
    if isinstance(root_elements, list):
        for element_index, element in enumerate(root_elements):
            if isinstance(element, dict):
                _visit_editable_element(
                    element=element,
                    path=f"elements[{element_index}]",
                    component_id="",
                    editable=editable,
                    include_visual_elements=include_visual_elements,
                )

    components = layout_dict.get("components", [])
    if not isinstance(components, list):
        return editable

    for component_index, component in enumerate(components):
        if not isinstance(component, dict):
            continue
        component_id = str(component.get("id") or "")
        elements = component.get("elements", [])
        if not isinstance(elements, list):
            continue
        for element_index, element in enumerate(elements):
            if isinstance(element, dict):
                _visit_editable_element(
                    element=element,
                    path=f"components[{component_index}].elements[{element_index}]",
                    component_id=component_id,
                    editable=editable,
                    include_visual_elements=include_visual_elements,
                )
    return editable


def _visit_editable_element(
    *,
    element: dict[str, Any],
    path: str,
    component_id: str,
    editable: list[dict[str, Any]],
    include_visual_elements: bool,
) -> None:
    element_type = str(element.get("type") or "")
    is_content_editable = element_type in CONTENT_EDITABLE_ELEMENT_TYPES
    if is_content_editable or (
        include_visual_elements and element_type in VISIBLE_ELEMENT_TYPES
    ):
        editable.append(
            {
                "path": path,
                "component_id": component_id,
                "type": element_type,
                "name": element.get("name"),
                "decorative": element.get("decorative"),
                "content_editable": is_content_editable,
                "geometry_editable": True,
                "content": _element_content(element),
                "style": _element_style(element),
                "limits": _element_limits(element),
            }
        )

    child = element.get("child")
    if isinstance(child, dict):
        _visit_editable_element(
            element=child,
            path=f"{path}.child",
            component_id=component_id,
            editable=editable,
            include_visual_elements=include_visual_elements,
        )

    children = element.get("children")
    if isinstance(children, list):
        for index, nested in enumerate(children):
            if isinstance(nested, dict):
                _visit_editable_element(
                    element=nested,
                    path=f"{path}.children[{index}]",
                    component_id=component_id,
                    editable=editable,
                    include_visual_elements=include_visual_elements,
                )


def _element_limits(element: dict[str, Any]) -> dict[str, Any]:
    keys = (
        "max_length",
        "min_length",
        "max_items",
        "min_items",
        "max_item_length",
        "min_item_length",
        "max_columns",
        "min_columns",
        "max_rows",
        "min_rows",
        "max_children",
        "min_children",
        "max_value",
        "min_value",
    )
    return {key: element[key] for key in keys if key in element}


def _element_content(element: dict[str, Any]) -> Any:
    element_type = element.get("type")
    if element_type == "text":
        return {"text": _runs_text(element.get("runs"))}
    if element_type == "math":
        return {
            "latex": element.get("latex"),
            "display_mode": element.get("display_mode", True),
        }
    if element_type == "text-list":
        items = element.get("items") if isinstance(element.get("items"), list) else []
        return {"items": [_runs_text(item) for item in items]}
    if element_type == "table":
        columns = element.get("columns")
        if not isinstance(columns, list) and isinstance(element.get("headers"), list):
            columns = element["headers"]
        if not isinstance(columns, list):
            columns = []
        return {
            "columns": [_table_value_text(cell) for cell in columns],
            "rows": [
                [_table_value_text(cell) for cell in row]
                for row in element.get("rows", [])
                if isinstance(row, list)
            ],
        }
    if element_type == "chart":
        return {
            "chart_type": element.get("chart_type"),
            "title": element.get("title"),
            "title_color": element.get("title_color"),
            "legend_color": element.get("legend_color"),
            "categories": element.get("categories"),
            "series": element.get("series"),
            "colors": element.get("colors"),
            "axis_color": element.get("axis_color"),
            "grid_color": element.get("grid_color"),
            "x_axis": element.get("x_axis"),
            "y_axis": element.get("y_axis"),
            "x_axis_grid": element.get("x_axis_grid"),
            "y_axis_grid": element.get("y_axis_grid"),
            "x_axis_title": element.get("x_axis_title"),
            "y_axis_title": element.get("y_axis_title"),
            "data_labels": element.get("data_labels"),
            "legend": element.get("legend"),
        }
    if element_type == "image":
        return {
            "data": element.get("data"),
            "is_icon": element.get("is_icon"),
        }
    if element_type == "vector":
        return {
            "shape": element.get("shape") or "polygon",
            "points": copy.deepcopy(element.get("points")),
            "closed": element.get("closed"),
            "curve": copy.deepcopy(element.get("curve")),
            "corner_radii": copy.deepcopy(element.get("corner_radii")),
        }
    if element_type == "infographic":
        return {
            "data": copy.deepcopy(element.get("data")),
            "colors": copy.deepcopy(element.get("colors")),
        }
    if element_type == "svg":
        svg = element.get("svg")
        return {
            "svg_length": len(svg) if isinstance(svg, str) else 0,
        }
    return None


def _element_style(element: dict[str, Any]) -> dict[str, Any]:
    keys = (
        "font",
        "alignment",
        "fill",
        "stroke",
        "color",
        "opacity",
        "shadow",
        "border_radius",
        "borderRadius",
        "padding",
        "marker",
        "fit",
        "focus_x",
        "focus_y",
        "crop_scale",
    )
    style = {key: copy.deepcopy(element[key]) for key in keys if key in element}
    base_font = style.get("font") if isinstance(style.get("font"), dict) else {}
    run_font = _first_text_font(element) or {}
    if base_font or run_font:
        style["font"] = {**copy.deepcopy(base_font), **run_font}
    return style


def _first_text_font(element: dict[str, Any]) -> dict[str, Any] | None:
    element_type = element.get("type")
    if element_type == "text":
        return _first_run_font(element.get("runs"))
    if element_type == "text-list":
        items = element.get("items")
        if not isinstance(items, list):
            return None
        for item in items:
            if isinstance(item, list):
                font = _first_run_font(item)
            elif isinstance(item, dict):
                font = (
                    copy.deepcopy(item["font"])
                    if isinstance(item.get("font"), dict)
                    else _first_run_font(item.get("runs"))
                )
            else:
                font = None
            if font:
                return font
    if element_type == "table":
        columns = element.get("columns")
        if isinstance(columns, list):
            for cell in columns:
                font = _table_cell_font(cell)
                if font:
                    return font
        rows = element.get("rows")
        if isinstance(rows, list):
            for row in rows:
                if not isinstance(row, list):
                    continue
                for cell in row:
                    font = _table_cell_font(cell)
                    if font:
                        return font
    return None


def _table_cell_font(cell: Any) -> dict[str, Any] | None:
    if not isinstance(cell, dict):
        return None
    if isinstance(cell.get("font"), dict):
        return copy.deepcopy(cell["font"])
    return _first_run_font(cell.get("runs"))


def _first_run_font(runs: Any) -> dict[str, Any] | None:
    if not isinstance(runs, list):
        return None
    for run in runs:
        if isinstance(run, dict) and isinstance(run.get("font"), dict):
            return copy.deepcopy(run["font"])
    return None


def _dicts(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _runs_text(value: Any) -> str:
    return text_runs_to_tagged_text(value)


def _searchable_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    try:
        return json.dumps(content, ensure_ascii=False)
    except Exception:
        return str(content)


def _snippet(text: str, query: str, limit: int = 220) -> str:
    normalized = text.replace("\n", " ")
    index = normalized.casefold().find(query.casefold())
    if index < 0:
        return normalized[:limit]
    start = max(0, index - 70)
    end = min(len(normalized), index + len(query) + 140)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(normalized) else ""
    return f"{prefix}{normalized[start:end]}{suffix}"


def _resolve_element_path(layout_dict: dict[str, Any], path: str) -> dict[str, Any]:
    current: Any = layout_dict
    for segment in path.split("."):
        if segment == "child":
            if not isinstance(current, dict) or not isinstance(current.get("child"), dict):
                raise ValueError(f"Invalid element path segment: {segment}")
            current = current["child"]
            continue

        match = _PATH_SEGMENT_RE.match(segment)
        if not match:
            raise ValueError(f"Invalid element path segment: {segment}")
        key = match.group("key")
        index = int(match.group("index"))
        if not isinstance(current, dict) or not isinstance(current.get(key), list):
            raise ValueError(f"Invalid element path segment: {segment}")
        values = current[key]
        if index >= len(values) or not isinstance(values[index], dict):
            raise ValueError(f"Invalid element path index: {segment}")
        current = values[index]

    if not isinstance(current, dict) or not isinstance(current.get("type"), str):
        raise ValueError("Path does not resolve to an element.")
    return current


def _resolve_layout_item_parent(
    layout_dict: dict[str, Any],
    path: str,
) -> tuple[list[Any], int]:
    current: Any = layout_dict
    segments = path.split(".")
    if not segments:
        raise ValueError("Layout item path is required.")

    for segment in segments[:-1]:
        if segment == "child":
            if not isinstance(current, dict) or not isinstance(current.get("child"), dict):
                raise ValueError(f"Invalid layout item path segment: {segment}")
            current = current["child"]
            continue

        match = _PATH_SEGMENT_RE.match(segment)
        if not match:
            raise ValueError(f"Invalid layout item path segment: {segment}")
        key = match.group("key")
        index = int(match.group("index"))
        if not isinstance(current, dict) or not isinstance(current.get(key), list):
            raise ValueError(f"Invalid layout item path segment: {segment}")
        values = current[key]
        if index >= len(values) or not isinstance(values[index], dict):
            raise ValueError(f"Invalid layout item path index: {segment}")
        current = values[index]

    match = _PATH_SEGMENT_RE.match(segments[-1])
    if not match:
        raise ValueError(f"Invalid layout item path segment: {segments[-1]}")
    key = match.group("key")
    index = int(match.group("index"))
    if not isinstance(current, dict) or not isinstance(current.get(key), list):
        raise ValueError(f"Invalid layout item path segment: {segments[-1]}")
    values = current[key]
    if index >= len(values):
        raise ValueError(f"Invalid layout item path index: {segments[-1]}")
    return values, index


def _preserve_slot_fields(
    target: dict[str, Any],
    slot: dict[str, Any],
    *,
    keep_id: bool,
) -> None:
    for key in ("position", "size", "rotation"):
        if key in slot:
            target[key] = copy.deepcopy(slot[key])
        else:
            target.pop(key, None)
    if keep_id:
        target["id"] = slot.get("id")


def _is_top_level_component_path(path: str) -> bool:
    match = _PATH_SEGMENT_RE.match(path)
    return bool(
        match
        and match.group("key") == "components"
        and match.group(0) == path
    )


def _component_id_for_path(layout_dict: dict[str, Any], path: str) -> str | None:
    first = path.split(".", 1)[0]
    match = _PATH_SEGMENT_RE.match(first)
    if not match or match.group("key") != "components":
        return None
    index = int(match.group("index"))
    components = layout_dict.get("components")
    if not isinstance(components, list) or index >= len(components):
        return None
    component = components[index]
    return str(component.get("id")) if isinstance(component, dict) else None


def _looks_like_chart_request(value: str) -> bool:
    if _looks_like_asset_reference(value):
        return False
    normalized = " ".join(value.casefold().split())
    if not normalized:
        return False
    chart_phrases = (
        "pie chart",
        "bar chart",
        "line chart",
        "area chart",
        "donut chart",
        "horizontal bar",
        "horizontal stack bar",
        "horizontal stacked bar",
        "stacked bar",
        "radial chart",
        "chart with",
        "chart showing",
        "dummy metrics",
        "dummy chart",
    )
    if any(phrase in normalized for phrase in chart_phrases):
        return True
    if "chart" not in normalized:
        return False
    return any(
        token in normalized
        for token in ("pie", "bar", "line", "donut", "metrics", "graph", "visualization")
    )


def _chart_request_on_image_error() -> ValueError:
    return ValueError(
        "Chart requests must use a chart element, not an image. If the target is an "
        "image/icon, delete that component and addComponent with type chart "
        "(chart_type bar|horizontal_bar|stacked_bar|line|area|pie|donut|"
        "scatter|bubble|radar|polar_area, title, categories, series with values, "
        "and optional colors). If the target is already chart, use updateElement "
        "with chart."
    )


def _looks_like_asset_reference(value: str) -> bool:
    stripped = value.strip()
    return stripped.startswith(
        ("http://", "https://", "/app_data/", "/static/", "data:", "blob:")
    )


def _chart_update_has_content(chart: dict[str, Any] | None) -> bool:
    if chart is None:
        return False
    return any(key in chart and chart.get(key) is not None for key in CHART_UPDATE_KEYS)


def _structured_update_has_content(value: dict[str, Any] | None) -> bool:
    return isinstance(value, dict) and bool(value)


def _resolve_image_update_payload(
    text: str | None,
    items: list[str] | None,
) -> str | dict[str, Any] | None:
    if text is not None:
        stripped = text.strip()
        if not stripped:
            return None
        if stripped.startswith("{") and stripped.endswith("}"):
            try:
                parsed = json.loads(stripped)
            except json.JSONDecodeError:
                parsed = None
            if isinstance(parsed, dict):
                return parsed
        return text
    if isinstance(items, list) and len(items) == 1:
        candidate = str(items[0] or "").strip()
        if candidate:
            return candidate
    return None


def _template_asset_url(value: Any) -> str | None:
    from utils.asset_directory_utils import normalize_slide_asset_url

    if isinstance(value, str):
        return normalize_slide_asset_url(value)
    if not isinstance(value, dict):
        return None

    fallback_url: str | None = None
    for key in (
        "data",
        "url",
        "image_url",
        "icon_url",
        "__image_url__",
        "__icon_url__",
    ):
        asset_url = value.get(key)
        if isinstance(asset_url, str) and asset_url.strip():
            normalized_url = normalize_slide_asset_url(asset_url)
            if _looks_like_asset_reference(normalized_url):
                return normalized_url
            if fallback_url is None:
                fallback_url = normalized_url
    return fallback_url


def _template_asset_prompt(value: Any, *, is_icon: bool) -> str | None:
    if not isinstance(value, dict):
        return None

    prompt_keys = (
        ("icon_query", "__icon_query__", "query", "prompt")
        if is_icon
        else ("image_prompt", "__image_prompt__", "prompt", "query")
    )
    for key in prompt_keys:
        prompt = value.get(key)
        if isinstance(prompt, str) and prompt.strip():
            return prompt
    return None


def _apply_image_element_value(element: dict[str, Any], value: Any) -> None:
    asset_url = _template_asset_url(value)
    if not asset_url:
        raise ValueError(
            "Image/icon updates require `text` with an image or icon URL."
        )
    element["data"] = asset_url
    _normalize_generated_image_fit(element, asset_url)
    prompt = _template_asset_prompt(
        value,
        is_icon=element.get("is_icon") is True,
    )
    if prompt:
        element["prompt"] = prompt


def _apply_image_element_update(
    element: dict[str, Any],
    *,
    text: str | None,
    items: list[str] | None,
) -> None:
    payload = _resolve_image_update_payload(text, items)
    if payload is None:
        raise ValueError(
            "Image/icon updates require `text` with an image or icon URL."
        )
    if isinstance(payload, str) and _looks_like_chart_request(payload):
        raise _chart_request_on_image_error()
    _apply_image_element_value(element, payload)


def _content_update_requested_for_type(
    element_type: str,
    *,
    text: str | None,
    items: list[str] | None,
    table_cell: dict[str, Any] | None,
    table: dict[str, Any] | None,
    chart: dict[str, Any] | None,
    vector: dict[str, Any] | None,
    infographic: dict[str, Any] | None,
) -> bool:
    if element_type in {"text", "math"}:
        return text is not None
    if element_type == "text-list":
        return items is not None
    if element_type == "table":
        return table is not None or table_cell is not None
    if element_type == "chart":
        return _chart_update_has_content(chart)
    if element_type == "vector":
        return _structured_update_has_content(vector)
    if element_type == "infographic":
        return _structured_update_has_content(infographic)
    if element_type == "image":
        return _resolve_image_update_payload(text, items) is not None
    return any(
        value is not None
        for value in (text, items, table_cell, table, chart, vector, infographic)
    )


def _update_vector_element(element: dict[str, Any], vector: dict[str, Any]) -> None:
    for key in (
        "shape",
        "points",
        "closed",
        "curve",
        "corner_radii",
        "start_marker",
        "end_marker",
    ):
        if key in vector:
            element[key] = copy.deepcopy(vector[key])
    _validate_vector_element(element)


def _update_infographic_element(
    element: dict[str, Any], infographic: dict[str, Any]
) -> None:
    if "data" in infographic:
        current_data = element.get("data")
        data_patch = _normalize_infographic_data_keys(infographic["data"])
        element["data"] = {
            **(copy.deepcopy(current_data) if isinstance(current_data, dict) else {}),
            **data_patch,
        }
    if "colors" in infographic:
        element["colors"] = copy.deepcopy(infographic["colors"])
    _validate_infographic_element(element)


_INFOGRAPHIC_DATA_KEY_ALIASES = {
    "afterLabel": "after_label",
    "beforeLabel": "before_label",
    "centerImage": "center_image",
    "centerLabel": "center_label",
    "highLabel": "high_label",
    "lowLabel": "low_label",
    "maxValue": "max_value",
    "minValue": "min_value",
    "parentId": "parent_id",
    "startColor": "start_color",
    "textColor": "text_color",
    "xAxisLabel": "x_axis_label",
    "yAxisLabel": "y_axis_label",
}


def _normalize_infographic_data_keys(value: Any) -> Any:
    if isinstance(value, list):
        return [_normalize_infographic_data_keys(item) for item in value]
    if not isinstance(value, dict):
        return copy.deepcopy(value)
    return {
        _INFOGRAPHIC_DATA_KEY_ALIASES.get(key, key): _normalize_infographic_data_keys(
            item
        )
        for key, item in value.items()
    }


def _update_text_element(element: dict[str, Any], text: str) -> None:
    _validate_text_length(
        text,
        min_length=element.get("min_length"),
        max_length=element.get("max_length"),
        label=str(element.get("name") or "text"),
    )
    element["runs"] = _replacement_runs(
        existing_runs=element.get("runs"),
        text=text,
        fallback_font=element.get("font"),
    )
    if any(run.get("type") == "latex" for run in element["runs"]):
        element.pop("text", None)
    else:
        # The Konva renderer reads flattened plain text in preference to runs.
        element["text"] = text


def _update_text_list_element(element: dict[str, Any], items: list[str]) -> None:
    min_items = _int_or_none(element.get("min_items"))
    max_items = _int_or_none(element.get("max_items"))
    if min_items is not None and len(items) < min_items:
        raise ValueError(f"Text list requires at least {min_items} item(s).")
    if max_items is not None and len(items) > max_items:
        raise ValueError(f"Text list allows at most {max_items} item(s).")

    for index, item in enumerate(items):
        _validate_text_length(
            item,
            min_length=element.get("min_item_length"),
            max_length=element.get("max_item_length"),
            label=f"list item {index + 1}",
        )

    source_items = element.get("items") if isinstance(element.get("items"), list) else []
    element["items"] = [
        _replacement_runs(
            existing_runs=source_items[index] if index < len(source_items) else None,
            text=item,
            fallback_font=element.get("font"),
        )
        for index, item in enumerate(items)
    ]


def _update_table_cell(element: dict[str, Any], table_cell: dict[str, Any]) -> None:
    section = table_cell["section"]
    column_index = int(table_cell["column_index"])
    text = str(table_cell.get("text") or "")
    if section == "columns":
        columns = element.get("columns")
        if not isinstance(columns, list) or column_index >= len(columns):
            raise ValueError("Invalid table column index.")
        target = columns[column_index]
    else:
        row_index = table_cell.get("row_index")
        rows = element.get("rows")
        if not isinstance(row_index, int) or not isinstance(rows, list) or row_index >= len(rows):
            raise ValueError("Invalid table row index.")
        row = rows[row_index]
        if not isinstance(row, list) or column_index >= len(row):
            raise ValueError("Invalid table cell column index.")
        target = row[column_index]

    if not isinstance(target, dict):
        raise ValueError("Target table cell is invalid.")
    target["runs"] = _replacement_runs(
        existing_runs=target.get("runs"),
        text=text,
        fallback_font=target.get("font"),
    )


def _update_table_element(element: dict[str, Any], table: dict[str, Any]) -> None:
    columns = table.get("columns") or table.get("headers")
    rows = table.get("rows")
    if not isinstance(columns, list) or not isinstance(rows, list):
        raise ValueError("table update requires columns/headers and rows.")
    if not all(isinstance(row, list) for row in rows):
        raise ValueError("table rows must be lists.")

    column_count = len(columns)
    if column_count == 0:
        raise ValueError("table must contain at least one column.")
    if any(len(row) != column_count for row in rows):
        raise ValueError("each table row must match the column count.")

    min_columns = int(element.get("min_columns") or 0)
    max_columns = int(element.get("max_columns") or max(column_count, 100))
    min_rows = int(element.get("min_rows") or 0)
    max_rows = int(element.get("max_rows") or max(len(rows), 100))
    if column_count < min_columns or column_count > max_columns:
        raise ValueError("table column count is outside this element's limits.")
    if len(rows) < min_rows or len(rows) > max_rows:
        raise ValueError("table row count is outside this element's limits.")

    existing_columns = _dicts(element.get("columns"))
    existing_rows = [
        _dicts(row) for row in element.get("rows", []) if isinstance(row, list)
    ]

    element["columns"] = [
        _replacement_table_cell(
            value=value,
            existing=existing_columns[index] if index < len(existing_columns) else None,
        )
        for index, value in enumerate(columns)
    ]
    element["rows"] = [
        [
            _replacement_table_cell(
                value=value,
                existing=(
                    existing_rows[row_index][column_index]
                    if row_index < len(existing_rows)
                    and column_index < len(existing_rows[row_index])
                    else None
                ),
            )
            for column_index, value in enumerate(row)
        ]
        for row_index, row in enumerate(rows)
    ]


def _replacement_table_cell(value: Any, existing: dict[str, Any] | None) -> dict[str, Any]:
    cell = copy.deepcopy(existing) if isinstance(existing, dict) else {}
    cell["runs"] = _replacement_runs(
        existing_runs=cell.get("runs"),
        text=_table_value_text(value),
        fallback_font=cell.get("font"),
    )
    return cell


def _table_value_text(value: Any) -> str:
    if isinstance(value, dict):
        runs = value.get("runs")
        if isinstance(runs, list):
            text = _runs_text(runs)
            if text:
                return text
        for key in ("text", "content", "value", "label", "data"):
            if key in value:
                return _table_value_text(value[key])
        return ""
    if isinstance(value, list):
        return "".join(_table_value_text(item) for item in value)
    if value is None:
        return ""
    return str(value)


def _update_chart_element(
    element: dict[str, Any],
    chart: dict[str, Any],
    theme: dict[str, Any] | None = None,
) -> None:
    _apply_chart_content_update(element, chart, theme)

    categories = element.get("categories")
    series = element.get("series")
    if isinstance(categories, list) and isinstance(series, list):
        category_count = len(categories)
        for item in series:
            if not isinstance(item, dict):
                continue
            values = item.get("values")
            if isinstance(values, list) and len(values) != category_count:
                raise ValueError("Each chart series must match the category count.")


TEXT_STYLE_ELEMENT_TYPES = {"text", "math", "text-list", "table"}


def _apply_element_style_patch(
    element: dict[str, Any],
    patch: dict[str, Any],
) -> None:
    element_type = str(element.get("type") or "")
    if "color" in patch:
        _apply_direct_color_patch(element, element_type, patch.get("color"), patch)

    font_patch = _text_font_patch_from_element_patch(element_type, patch)
    if not font_patch:
        return

    if element_type == "text":
        _apply_font_patch_to_text_element(element, font_patch)
    elif element_type == "math":
        _merge_font_patch(element, font_patch)
    elif element_type == "text-list":
        _apply_font_patch_to_text_list_element(element, font_patch)
    elif element_type == "table":
        _apply_font_patch_to_table_element(element, font_patch)


def _apply_direct_color_patch(
    element: dict[str, Any],
    element_type: str,
    value: Any,
    patch: dict[str, Any],
) -> None:
    if not isinstance(value, str) or not value.strip():
        return
    if element_type in TEXT_STYLE_ELEMENT_TYPES:
        font = element.get("font") if isinstance(element.get("font"), dict) else {}
        element["font"] = {**font, "color": value}
        return
    if element_type == "vector":
        points = element.get("points") if isinstance(element.get("points"), list) else []
        explicit_closed = element.get("closed")
        is_closed = element.get("shape") == "ellipse" or (
            explicit_closed if isinstance(explicit_closed, bool) else len(points) > 2
        )
        style_key = "fill" if is_closed else "stroke"
        style = element.get(style_key) if isinstance(element.get(style_key), dict) else {}
        element[style_key] = {**style, "color": value}
        return
    if element_type == "infographic":
        colors = element.get("colors") if isinstance(element.get("colors"), list) else []
        element["colors"] = [*(colors[:1] or ["#E5E7EB"]), value, *colors[2:]]
        return
    if "fill" not in patch and element_type in {
        "container",
        "flex",
        "grid",
        "grid-view",
        "group",
    }:
        fill = element.get("fill") if isinstance(element.get("fill"), dict) else {}
        element["fill"] = {**fill, "color": value}


def _text_font_patch_from_element_patch(
    element_type: str,
    patch: dict[str, Any],
) -> dict[str, Any]:
    if element_type not in TEXT_STYLE_ELEMENT_TYPES:
        return {}

    font_patch: dict[str, Any] = {}
    raw_font = patch.get("font")
    if isinstance(raw_font, dict):
        font_patch.update(_normalize_font_patch(raw_font))
    direct_color = patch.get("color")
    if isinstance(direct_color, str) and direct_color.strip():
        font_patch["color"] = direct_color
    return {
        key: copy.deepcopy(value)
        for key, value in font_patch.items()
        if value is not None
    }


def _normalize_font_patch(value: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    aliases = {
        "family": "family",
        "fontFamily": "family",
        "font_family": "family",
        "fontName": "family",
        "font_name": "family",
        "name": "family",
        "size": "size",
        "fontSize": "size",
        "font_size": "size",
        "color": "color",
        "fontColor": "color",
        "font_color": "color",
        "textColor": "color",
        "text_color": "color",
        "bold": "bold",
        "italic": "italic",
        "underline": "underline",
        "line_height": "line_height",
        "lineHeight": "line_height",
        "letter_spacing": "letter_spacing",
        "letterSpacing": "letter_spacing",
        "wrap": "wrap",
        "ellipsis": "ellipsis",
        "opacity": "opacity",
    }
    for source_key, target_key in aliases.items():
        if source_key in value:
            normalized[target_key] = value[source_key]
    return normalized


def _apply_font_patch_to_text_element(
    element: dict[str, Any],
    font_patch: dict[str, Any],
) -> None:
    _merge_font_patch(element, font_patch)
    runs = element.get("runs")
    if not isinstance(runs, list) or not runs:
        text = str(element.get("text") or "")
        element["runs"] = [{"text": text, "font": copy.deepcopy(element["font"])}]
        return
    for run in runs:
        if isinstance(run, dict):
            _merge_font_patch(run, font_patch)


def _apply_font_patch_to_text_list_element(
    element: dict[str, Any],
    font_patch: dict[str, Any],
) -> None:
    _merge_font_patch(element, font_patch)
    items = element.get("items")
    if not isinstance(items, list):
        return
    for index, item in enumerate(items):
        if isinstance(item, list):
            for run in item:
                if isinstance(run, dict):
                    _merge_font_patch(run, font_patch)
        elif isinstance(item, dict):
            _merge_font_patch(item, font_patch)
            runs = item.get("runs")
            if isinstance(runs, list):
                for run in runs:
                    if isinstance(run, dict):
                        _merge_font_patch(run, font_patch)
        elif isinstance(item, str):
            items[index] = [{"text": item, "font": copy.deepcopy(element["font"])}]


def _apply_font_patch_to_table_element(
    element: dict[str, Any],
    font_patch: dict[str, Any],
) -> None:
    _merge_font_patch(element, font_patch)
    columns = element.get("columns")
    if isinstance(columns, list):
        for cell in columns:
            _apply_font_patch_to_table_cell(cell, font_patch)
    rows = element.get("rows")
    if isinstance(rows, list):
        for row in rows:
            if isinstance(row, list):
                for cell in row:
                    _apply_font_patch_to_table_cell(cell, font_patch)


def _apply_font_patch_to_table_cell(
    cell: Any,
    font_patch: dict[str, Any],
) -> None:
    if not isinstance(cell, dict):
        return
    _merge_font_patch(cell, font_patch)
    runs = cell.get("runs")
    if not isinstance(runs, list) or not runs:
        return
    for run in runs:
        if isinstance(run, dict):
            _merge_font_patch(run, font_patch)


def _merge_font_patch(target: dict[str, Any], font_patch: dict[str, Any]) -> None:
    source = target.get("font") if isinstance(target.get("font"), dict) else {}
    target["font"] = {
        **source,
        **copy.deepcopy(font_patch),
    }


def _replacement_runs(
    *,
    existing_runs: Any,
    text: str,
    fallback_font: Any,
) -> list[dict[str, Any]]:
    return replace_text_runs(existing_runs, text, fallback_font)


def _validate_text_length(
    text: str,
    *,
    min_length: Any,
    max_length: Any,
    label: str,
) -> None:
    min_value = _int_or_none(min_length)
    max_value = _int_or_none(max_length)
    if min_value is not None and len(text) < min_value:
        raise ValueError(f"{label} must be at least {min_value} character(s).")
    if max_value is not None and len(text) > max_value:
        raise ValueError(f"{label} must be at most {max_value} character(s).")


def _int_or_none(value: Any) -> int | None:
    return value if isinstance(value, int) else None
