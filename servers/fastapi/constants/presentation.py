import os
from pathlib import Path

MAX_NUMBER_OF_SLIDES = 50
DEFAULT_MAX_OUTLINE_WORDS = 100


def get_max_outline_words() -> int:
    raw_value = (os.getenv("MAX_OUTLINE_WORDS") or "").strip()
    if not raw_value:
        return DEFAULT_MAX_OUTLINE_WORDS

    try:
        value = int(raw_value)
    except ValueError as exc:
        raise ValueError("MAX_OUTLINE_WORDS must be a positive integer") from exc

    if value <= 0:
        raise ValueError("MAX_OUTLINE_WORDS must be a positive integer")
    return value


MAX_OUTLINE_CONTENT_WORDS = get_max_outline_words()

_PREFERRED_TEMPLATE_ORDER = [
    "momentum",
    "dynamic",
    "executive",
    "general",
    "modern",
    "standard",
    "swift",
]


def _discover_default_templates() -> list[str]:
    templates_dir = Path(__file__).resolve().parents[3] / "templates"

    if not templates_dir.is_dir():
        return []

    discovered = {
        entry.name
        for entry in templates_dir.iterdir()
        if entry.is_dir() and (entry / "template.json").is_file()
    }

    ordered = [name for name in _PREFERRED_TEMPLATE_ORDER if name in discovered]
    extras = sorted(discovered - set(ordered))
    return ordered + extras


DEFAULT_TEMPLATES = _discover_default_templates()
