
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




def _norm_hex(value: Any) -> str:
    raw = str(value or "").strip().lstrip("#")
    return raw.lower() if raw else ""


def recolor_slide_ui(ui: Any, old_colors: dict[str, Any], new_colors: dict[str, Any], pack_id: str) -> Any:
    from copy import deepcopy

    mapping: dict[str, str] = {}
    for key in _TOKEN_COLOR_KEYS:
        old = _norm_hex(old_colors.get(key))
        new = _norm_hex(new_colors.get(key))
        if old and new and old != new:
            mapping[old] = new
            mapping["#" + old] = "#" + new
    bg = _norm_hex(new_colors.get("background"))
    tree = deepcopy(ui) if ui is not None else {}

    def paint(value: Any) -> Any:
        if isinstance(value, str):
            key = value.strip()
            low = key.lower()
            if low in mapping:
                return mapping[low]
            if low.lstrip("#") in mapping:
                nxt = mapping[low.lstrip("#")]
                return "#" + nxt if key.startswith("#") else nxt
            return value
        if isinstance(value, dict):
            return {k: paint(v) for k, v in value.items()}
        if isinstance(value, list):
            return [paint(v) for v in value]
        return value

    tree = paint(tree)
    if isinstance(tree, dict):
        tree["pack_restyle"] = pack_id
        if bg:
            tree["background"] = "#" + bg.upper() if False else "#" + bg
    return tree


def presentation_theme_from_pack(pack: dict[str, Any]) -> dict[str, Any]:
    tokens = pack.get("tokens") or {}
    return {
        "name": pack["name"],
        "source": "brand-pack",
        "brand_pack_id": pack["id"],
        "data": tokens,
        "logo": (tokens.get("logo") if isinstance(tokens, dict) else None),
        "background_image": (tokens.get("background_image") if isinstance(tokens, dict) else None),
    }


def update_brand_pack(pack_id: str, body: dict[str, Any]) -> dict[str, Any]:
    pack = load_brand_pack(pack_id)
    if body.get("name"):
        pack["name"] = str(body["name"]).strip()
    incoming = body.get("tokens") or body
    current = pack.get("tokens") or {}
    colors = dict(current.get("colors") or {})
    src = incoming.get("colors") if isinstance(incoming.get("colors"), dict) else incoming
    if isinstance(src, dict):
        for key in _TOKEN_COLOR_KEYS:
            if src.get(key):
                colors[key] = str(src[key]).strip()
    tokens = {"colors": colors}
    fonts = incoming.get("fonts") if isinstance(incoming.get("fonts"), dict) else current.get("fonts")
    if fonts:
        tokens["fonts"] = fonts
    for extra in ("logo", "background_image"):
        if extra in incoming:
            tokens[extra] = incoming[extra]
        elif extra in current:
            tokens[extra] = current[extra]
    leaked = [key for key in tokens.keys() if str(key).lower() in _FORBIDDEN]
    if leaked:
        raise HTTPException(422, f"Brand pack tokens cannot include {', '.join(leaked)}")
    pack["tokens"] = tokens
    path = _packs_dir() / f"{pack['id']}.json"
    path.write_text(json.dumps(pack, ensure_ascii=False, indent=2))
    return pack



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



PACK_STRUCTURE = {
    "monetka": ["cover", "kpi-trend-takeaway", "split-60-40", "takeaway"],
    "otryad": ["cover", "matrix-2x2", "columns-2", "decision"],
    "silicon-dozer": ["cover", "split-40-60", "kpi-trend-takeaway", "architecture"],
}


def _hex(value, fallback="111111"):
    raw = str(value or fallback).strip().lstrip("#")
    return raw or fallback


def _collect_content(ui):
    texts, charts, images = [], [], []

    def walk(node):
        if isinstance(node, dict):
            kind = str(node.get("type") or "")
            if node.get("decorative"):
                for value in list(node.values()):
                    walk(value)
                return
            if kind == "text":
                texts.append(node)
            elif kind == "chart":
                charts.append(node)
            elif kind == "image":
                images.append(node)
            else:
                for value in list(node.values()):
                    walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(ui)
    return texts, charts, images


def _bg_poly(color):
    return {
        "type": "vector",
        "shape": "polygon",
        "points": [{"x": 0, "y": 0}, {"x": 1280, "y": 0}, {"x": 1280, "y": 720}, {"x": 0, "y": 720}],
        "closed": True,
        "fill": {"color": "#%s" % color},
        "decorative": True,
    }


def _bar(x, y, w, h, color):
    return {
        "type": "vector",
        "shape": "polygon",
        "points": [{"x": x, "y": y}, {"x": x + w, "y": y}, {"x": x + w, "y": y + h}, {"x": x, "y": y + h}],
        "closed": True,
        "fill": {"color": "#%s" % color},
        "decorative": True,
    }


def rebuild_slide_for_pack(ui, pack, slide_index=0):
    from copy import deepcopy

    colors = ((pack.get("tokens") or {}).get("colors") or {})
    primary = _hex(colors.get("primary"), "F26B00")
    ink = _hex(colors.get("background_text") or colors.get("primary"), "1F1A14")
    bg = _hex(colors.get("background"), "FFFFFF")
    card = _hex(colors.get("card") or colors.get("background"), bg)
    graphs = [_hex(colors.get("graph_%s" % i)) for i in range(4) if colors.get("graph_%s" % i)]
    layouts = PACK_STRUCTURE.get(pack["id"], ["takeaway"])
    layout = layouts[slide_index % len(layouts)]
    texts, charts, images = _collect_content(ui)
    texts = [deepcopy(item) for item in texts]
    charts = [deepcopy(item) for item in charts]
    images = [deepcopy(item) for item in images]

    def paint_text(el, color):
        el["color"] = color
        for run in el.get("runs") or []:
            if isinstance(run, dict):
                run["color"] = color
        return el

    def place(el, x, y, w, h):
        el["position"] = {"x": x, "y": y}
        el["size"] = {"width": w, "height": h}
        return el

    elements = [_bg_poly(bg), _bar(0, 0, 1280, 64, primary)]
    if layout == "cover":
        if texts:
            elements.append(place(paint_text(texts[0], ink), 64, 160, 1150, 120))
        for i, el in enumerate(texts[1:4]):
            elements.append(place(paint_text(el, ink), 64, 320 + i * 80, 900, 64))
        for el in charts[:1]:
            if graphs:
                el["colors"] = graphs
            elements.append(place(el, 720, 320, 500, 300))
    elif layout == "matrix-2x2":
        cells = [(48, 88), (664, 88), (48, 400), (664, 400)]
        for i, el in enumerate(texts[:4]):
            x, y = cells[i]
            elements.append(_bar(x, y, 568, 280, card))
            elements.append(place(paint_text(el, ink), x + 24, y + 24, 520, 230))
    elif layout in ("split-60-40", "split-40-60"):
        left_w, right_x = (760, 840) if layout == "split-60-40" else (440, 520)
        elements.append(_bar(40, 88, left_w, 580, card))
        elements.append(_bar(right_x, 88, 1280 - right_x - 40, 580, card))
        mid = max(1, len(texts) // 2 or 1)
        y = 110
        for el in texts[:mid]:
            elements.append(place(paint_text(el, ink), 64, y, left_w - 48, 70))
            y += 80
        y = 110
        for el in texts[mid:]:
            elements.append(place(paint_text(el, ink), right_x + 24, y, 380, 70))
            y += 80
        for el in charts[:1]:
            if graphs:
                el["colors"] = graphs
            elements.append(place(el, right_x + 24, 360, 380, 280))
    elif layout == "kpi-trend-takeaway":
        for i, el in enumerate(texts[:3]):
            x = 48 + i * 410
            elements.append(_bar(x, 96, 390, 160, card))
            elements.append(place(paint_text(el, ink), x + 16, 112, 358, 128))
        rest_y = 290
        for el in texts[3:]:
            elements.append(place(paint_text(el, ink), 48, rest_y, 1180, 64))
            rest_y += 72
        for el in charts[:1]:
            if graphs:
                el["colors"] = graphs
            elements.append(place(el, 48, 430, 1180, 250))
    else:
        y = 96
        for el in texts:
            elements.append(place(paint_text(el, ink), 48, y, 1180, 64))
            y += 72
        for el in charts[:1]:
            if graphs:
                el["colors"] = graphs
            elements.append(place(el, 48, min(y, 400), 1180, 280))
    for el in images[:2]:
        elements.append(el)
    return {
        "id": "pack-%s-%s" % (pack["id"], layout),
        "description": "%s / %s" % (pack.get("name") or pack["id"], layout),
        "background": "#%s" % bg,
        "components": [],
        "elements": elements,
        "pack_restyle": pack["id"],
        "layout": layout,
        "layout_group": "r1",
    }


def restyle_slide_ui(ui, pack):
    return rebuild_slide_for_pack(ui, pack, 0)
