
"""R1 F14: structural quality checks. Fixes go through operations, not silent rewrite."""

from __future__ import annotations

from typing import Any


def _iter(tree: Any):
    if isinstance(tree, dict):
        yield tree
        for value in tree.values():
            yield from _iter(value)
    elif isinstance(tree, list):
        for item in tree:
            yield from _iter(item)


def check_presentation(snapshot: dict[str, Any]) -> dict[str, Any]:
    issues: list[dict[str, Any]] = []
    for slide in snapshot.get("slides") or []:
        sid = slide.get("id")
        ui = slide.get("ui") or {}
        text_len = 0
        images = 0
        empty_images = 0
        for el in _iter(ui):
            if el.get("type") == "text":
                runs = el.get("runs") or []
                text_len += sum(len(str(r.get("text") or "")) if isinstance(r, dict) else len(str(r)) for r in runs)
            if el.get("type") == "image":
                images += 1
                src = el.get("data") or el.get("src") or ""
                if not src or "placeholder" in str(src):
                    empty_images += 1
                    issues.append({"code": "empty_image", "slideId": sid, "fix": "replace-image"})
        if text_len > 1200:
            issues.append({"code": "overflow_text", "slideId": sid, "chars": text_len, "fix": "shorten-text"})
        has_block = any(
            isinstance(el, dict) and el.get("type") in {"chart", "table", "infographic"}
            for el in _iter(ui)
        )
        title = (slide.get("content") or {}).get("title")
        if text_len == 0 and images == 0 and not has_block and not title:
            issues.append({"code": "empty_slide", "slideId": sid, "fix": "fill-or-delete"})
    return {"ok": not issues, "issues": issues}


def shorten_overflow_text(ui: dict, limit: int = 1100) -> bool:
    """Truncate text runs so total chars <= limit. Returns True if changed."""
    changed = False
    remaining = limit
    for el in _iter(ui):
        if el.get("type") != "text":
            continue
        runs = el.get("runs") or []
        new_runs = []
        for run in runs:
            text = str(run.get("text") or "") if isinstance(run, dict) else str(run)
            if remaining <= 0:
                changed = True
                continue
            if len(text) > remaining:
                text = text[:remaining]
                changed = True
                remaining = 0
            else:
                remaining -= len(text)
            if isinstance(run, dict):
                new_runs.append({**run, "text": text})
            else:
                new_runs.append(text)
        if changed:
            el["runs"] = new_runs
    return changed


def fill_empty_slide_ui(ui: dict | None) -> dict:
    base = dict(ui or {})
    has_text = False
    for el in _iter(base):
        if el.get("type") == "text":
            runs = el.get("runs") or []
            if any((r.get("text") if isinstance(r, dict) else r) for r in runs):
                has_text = True
                break
    if has_text:
        return base
    components = list(base.get("components") or [])
    components.append({
        "id": "filled_empty_title",
        "elements": [{
            "type": "text",
            "position": {"x": 40, "y": 40},
            "size": {"width": 800, "height": 80},
            "runs": [{"text": "Untitled slide"}],
        }],
    })
    base["components"] = components
    base.setdefault("background", "#FFFFFF")
    return base
