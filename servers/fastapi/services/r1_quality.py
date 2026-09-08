
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
        if not ui and not (slide.get("content") or {}).get("title"):
            issues.append({"code": "empty_slide", "slideId": sid, "fix": "fill-or-delete"})
    return {"ok": not issues, "issues": issues}
