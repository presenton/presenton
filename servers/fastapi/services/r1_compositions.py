
"""R1 F07 composition catalog. Switching layout must keep text and numbers."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from fastapi import HTTPException

CATALOG = {
    "cover": {"layout_group": "standard", "layout": "cover", "areas": ["title", "subtitle"]},
    "takeaway": {"layout_group": "standard", "layout": "takeaway", "areas": ["title", "body"]},
    "columns-2": {"layout_group": "standard", "layout": "two-column", "areas": ["left", "right"]},
    "columns-3": {"layout_group": "standard", "layout": "three-column", "areas": ["a", "b", "c"]},
    "split-60-40": {"layout_group": "r1", "layout": "split-60-40", "areas": ["primary", "aside"]},
    "split-40-60": {"layout_group": "r1", "layout": "split-40-60", "areas": ["aside", "primary"]},
    "kpi-trend-takeaway": {"layout_group": "r1", "layout": "kpi-trend-takeaway", "areas": ["kpi", "trend", "takeaway"]},
    "matrix-2x2": {"layout_group": "r1", "layout": "matrix-2x2", "areas": ["nw", "ne", "sw", "se"]},
    "architecture": {"layout_group": "r1", "layout": "architecture", "areas": ["nodes"]},
    "roadmap": {"layout_group": "r1", "layout": "roadmap", "areas": ["milestones"]},
    "risks": {"layout_group": "r1", "layout": "risks", "areas": ["risks"]},
    "decision": {"layout_group": "r1", "layout": "decision", "areas": ["options", "choice"]},
}


def list_compositions() -> list[dict[str, Any]]:
    return [{"id": key, **value} for key, value in CATALOG.items()]


def apply_composition(slide: dict[str, Any], composition_id: str) -> dict[str, Any]:
    spec = CATALOG.get(composition_id)
    if not spec:
        raise HTTPException(422, f"Unknown composition: {composition_id}")
    next_slide = deepcopy(slide)
    next_slide["layout_group"] = spec["layout_group"]
    next_slide["layout"] = spec["layout"]
    return next_slide
