from pathlib import Path

MAX_NUMBER_OF_SLIDES = 50
MAX_OUTLINE_CONTENT_WORDS = 100

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
