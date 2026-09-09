
"""R1 F09: chart series are the source of truth; type changes do not mutate values."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from fastapi import HTTPException

R1_CHART_TYPES = {
    "bar",
    "line",
    "stacked_bar",
    "donut",
    "waterfall",
    "heatmap",
    "histogram",
    "scatter",
}


def normalize_chart_data(element: dict[str, Any]) -> dict[str, Any]:
    categories = [str(c) for c in (element.get("categories") or [])]
    series_in = element.get("series") or []
    series: list[dict[str, Any]] = []
    for index, item in enumerate(series_in):
        if not isinstance(item, dict):
            continue
        values = []
        for raw in item.get("values") or item.get("data") or []:
            try:
                values.append(float(raw))
            except (TypeError, ValueError) as exc:
                raise HTTPException(422, f"Chart values must be numeric, got {raw!r}") from exc
        series.append({"name": str(item.get("name") or f"Series {index + 1}"), "values": values})
    if not categories and element.get("data"):
        categories = [str(row.get("label") or f"Item {i+1}") for i, row in enumerate(element.get("data") or [])]
        if not series:
            series = [{"name": "Series 1", "values": [float(row.get("value") or 0) for row in element.get("data") or []]}]
    width = max([len(categories)] + [len(s["values"]) for s in series] or [0])
    if width == 0:
        raise HTTPException(422, "Chart has no categories or values")
    categories = [(categories[i] if i < len(categories) else f"Item {i+1}") for i in range(width)]
    for item in series:
        item["values"] = [(item["values"][i] if i < len(item["values"]) else 0.0) for i in range(width)]
    return {
        "categories": categories,
        "series": series,
        "unit": element.get("unit"),
        "period": element.get("period"),
        "source": element.get("source"),
    }


def change_chart_type(element: dict[str, Any], chart_type: str) -> dict[str, Any]:
    if chart_type not in R1_CHART_TYPES:
        raise HTTPException(422, f"Unsupported R1 chart type: {chart_type}")
    data = normalize_chart_data(element)
    next_element = deepcopy(element)
    next_element["chart_type"] = chart_type
    next_element.pop("chartType", None)
    next_element["categories"] = data["categories"]
    next_element["series"] = data["series"]
    if chart_type in {"donut"}:
        next_element["series"] = [data["series"][0]]
    return next_element


def replace_chart_values(
    element: dict[str, Any],
    *,
    categories: list[str] | None = None,
    series: list[dict[str, Any]] | None = None,
    unit: str | None = None,
    period: str | None = None,
    source: str | None = None,
) -> dict[str, Any]:
    next_element = deepcopy(element)
    if categories is not None:
        next_element["categories"] = [str(c) for c in categories]
    if series is not None:
        next_element["series"] = series
    if unit is not None:
        next_element["unit"] = unit
    if period is not None:
        next_element["period"] = period
    if source is not None:
        next_element["source"] = source
    return {**next_element, **normalize_chart_data(next_element)}


def iter_chart_elements(tree: Any):
    if isinstance(tree, dict):
        if tree.get("type") == "chart":
            yield tree
        for value in tree.values():
            yield from iter_chart_elements(value)
    elif isinstance(tree, list):
        for item in tree:
            yield from iter_chart_elements(item)


def values_fingerprint(element: dict[str, Any]) -> tuple:
    data = normalize_chart_data(element)
    return (
        tuple(data["categories"]),
        tuple((s["name"], tuple(s["values"])) for s in data["series"]),
    )
