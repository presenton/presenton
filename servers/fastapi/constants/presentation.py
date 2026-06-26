import re
from pathlib import Path

MAX_NUMBER_OF_SLIDES = 50

_PREFERRED_TEMPLATE_ORDER = [
    "general",
    "modern",
    "standard",
    "swift",
    "code",
    "education",
    "product-overview",
    "report",
    "pitch-deck",
    "neo-general",
    "neo-standard",
    "neo-modern",
    "neo-swift",
]


def _normalize_template_group_id(directory_name: str) -> str:
    """Map template folder names to the runtime template IDs."""
    cleaned = re.sub(r"(?<!^)(?=[A-Z])", "-", directory_name).lower()
    return cleaned.replace("_", "-")


def _discover_default_templates() -> list[str]:
    templates_dir = (
        Path(__file__).resolve().parents[2]
        / "nextjs"
        / "app"
        / "presentation-templates"
    )

    if not templates_dir.is_dir():
        return list(_PREFERRED_TEMPLATE_ORDER)

    discovered = {
        _normalize_template_group_id(entry.name)
        for entry in templates_dir.iterdir()
        if entry.is_dir() and (entry / "settings.json").is_file()
    }

    ordered = [name for name in _PREFERRED_TEMPLATE_ORDER if name in discovered]
    extras = sorted(discovered - set(ordered))
    return ordered + extras


DEFAULT_TEMPLATES = _discover_default_templates()
