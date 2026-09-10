
"""R1 brand packs: token-only design systems, no document metadata."""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from utils.get_env import get_app_data_directory_env

_TOKEN_COLOR_KEYS = (
    "primary",
    "background",
    "card",
    "stroke",
    "background_text",
    "primary_text",
    *[f"graph_{i}" for i in range(10)],
)
_FORBIDDEN = {
    "title",
    "date",
    "dates",
    "project",
    "projects",
    "created_at",
    "slides",
    "n_slides",
    "speaker_note",
    "content",
}


def _packs_dir() -> Path:
    root = Path(get_app_data_directory_env() or "/tmp/presenton")
    path = root / "brand_packs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _safe_id(raw: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "-", (raw or "").strip())[:64].strip("-")
    return cleaned or uuid.uuid4().hex[:12]


def extract_tokens(payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("tokens") or payload.get("data") or payload
    if not isinstance(data, dict):
        raise HTTPException(422, "Brand pack tokens must be an object")
    colors_src = data.get("colors") if isinstance(data.get("colors"), dict) else data
    colors = {}
    for key in _TOKEN_COLOR_KEYS:
        value = colors_src.get(key)
        if isinstance(value, str) and value.strip():
            colors[key] = value.strip()
    fonts = data.get("fonts") if isinstance(data.get("fonts"), dict) else None
    tokens: dict[str, Any] = {"colors": colors}
    if fonts:
        tokens["fonts"] = fonts
    leaked = [key for key in data.keys() if str(key).lower() in _FORBIDDEN]
    if leaked:
        raise HTTPException(422, f"Brand pack tokens cannot include {', '.join(leaked)}")
    if not colors.get("primary") or not colors.get("background"):
        raise HTTPException(422, "Brand pack needs at least primary and background colors")
    return tokens


def presentation_theme_from_pack(pack: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": pack["name"],
        "source": "brand-pack",
        "brand_pack_id": pack["id"],
        "data": pack["tokens"],
    }


def save_brand_pack(body: dict[str, Any]) -> dict[str, Any]:
    pack_id = _safe_id(str(body.get("id") or uuid.uuid4().hex[:12]))
    name = (body.get("name") or pack_id).strip()
    tokens = extract_tokens(body)
    pack = {"id": pack_id, "name": name, "tokens": tokens}
    path = _packs_dir() / f"{pack_id}.json"
    path.write_text(json.dumps(pack, ensure_ascii=False, indent=2))
    return pack


def load_brand_pack(pack_id: str) -> dict[str, Any]:
    path = _packs_dir() / f"{_safe_id(pack_id)}.json"
    if not path.exists():
        raise HTTPException(404, f"Brand pack not found: {pack_id}")
    return json.loads(path.read_text())


def list_brand_packs() -> list[dict[str, Any]]:
    packs = []
    for path in sorted(_packs_dir().glob("*.json")):
        try:
            packs.append(json.loads(path.read_text()))
        except Exception:
            continue
    return packs


DOZER_COMPONENTS = [
    {"id": "kpi", "label": "KPI", "kind": "text", "group": "metrics"},
    {"id": "punch", "label": "KPI row", "kind": "kpi-row", "group": "metrics"},
    {"id": "waterfall", "label": "Waterfall", "kind": "chart", "group": "charts"},
    {"id": "matrix-2x2", "label": "Matrix 2x2", "kind": "composition", "group": "layouts"},
    {"id": "split-60-40", "label": "Split 60/40", "kind": "composition", "group": "layouts"},
    {"id": "tokens", "label": "Brand tokens", "kind": "theme", "group": "brand"},
]


def pack_components(pack_id: str) -> list[dict[str, Any]]:
    pack = load_brand_pack(pack_id)
    if pack["id"] in {"m894-r1-pilot", "monetka", "otryad", "silicon-dozer"}:
        return list(DOZER_COMPONENTS)
    stored = pack.get("components")
    if isinstance(stored, list) and stored:
        return stored
    return []



def restyle_slide_ui(ui: Any, pack: dict[str, Any]) -> dict[str, Any]:
    from copy import deepcopy

    colors = ((pack.get("tokens") or {}).get("colors") or {})
    primary = str(colors.get("primary") or "").lstrip("#")
    ink = str(colors.get("background_text") or primary).lstrip("#")
    bg = str(colors.get("background") or "").lstrip("#")
    card = str(colors.get("card") or bg).lstrip("#")
    graphs = [str(colors.get(f"graph_{i}") or "").lstrip("#") for i in range(10)]
    graphs = [g for g in graphs if g]
    tree = deepcopy(ui) if isinstance(ui, dict) else {"components": []}

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            kind = str(node.get("type") or "")
            if kind == "text" and ink:
                node["color"] = ink
                for run in node.get("runs") or []:
                    if isinstance(run, dict):
                        run["color"] = ink
            if kind == "chart":
                if graphs:
                    node["colors"] = list(graphs)
                if primary:
                    node["color"] = primary
            if kind in {"shape", "rect", "container", "box"} and card:
                node["fill"] = card
                node["background"] = card
            for value in list(node.values()):
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(tree)
    tree["pack_restyle"] = pack["id"]
    if bg:
        tree["background"] = bg
    return tree
