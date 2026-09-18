
"""R1 F10: infographic nodes/edges stored separately from the visual."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from fastapi import HTTPException


def model_from_element(element: dict[str, Any]) -> dict[str, Any]:
    if element.get("type") != "infographic" and not element.get("infographic_type"):
        raise HTTPException(422, "Not an infographic element")
    nodes = element.get("nodes")
    if not isinstance(nodes, list) or not nodes:
        labels = element.get("labels") or []
        nodes = [{"id": f"n{i}", "label": str(item)} for i, item in enumerate(labels)]
        if not nodes and element.get("data"):
            nodes = [{"id": f"n{i}", "label": str(item)} for i, item in enumerate(element.get("data") or [])]
    edges = element.get("edges")
    if not isinstance(edges, list):
        edges = [{"from": nodes[i]["id"], "to": nodes[i + 1]["id"]} for i in range(len(nodes) - 1)]
    return {
        "kind": str(element.get("infographic_type") or element.get("kind") or "process"),
        "nodes": nodes,
        "edges": edges,
        "visual": element.get("visual") or "template",
    }


def apply_model(element: dict[str, Any], model: dict[str, Any]) -> dict[str, Any]:
    next_element = deepcopy(element)
    next_element["nodes"] = model["nodes"]
    next_element["edges"] = model["edges"]
    next_element["infographic_type"] = model.get("kind") or next_element.get("infographic_type")
    return next_element
