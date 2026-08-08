from collections.abc import Mapping
from typing import Any, Literal, TypeAlias


DEFAULT_ICON_WEIGHT = "bold"
ALLOWED_ICON_WEIGHTS = ("bold", "duotone", "fill", "light", "regular", "thin")

DEFAULT_ICON_TYPE = DEFAULT_ICON_WEIGHT
ALLOWED_ICON_TYPES = ALLOWED_ICON_WEIGHTS
IconType: TypeAlias = Literal["bold", "duotone", "fill", "light", "regular", "thin"]


def normalize_icon_weight(value: Any) -> str:
    if not isinstance(value, str):
        return DEFAULT_ICON_WEIGHT

    normalized = value.strip().lower().replace("_", "-")
    if normalized in ALLOWED_ICON_WEIGHTS:
        return normalized
    return DEFAULT_ICON_WEIGHT


def normalize_icon_type(value: Any) -> str:
    return normalize_icon_weight(value)


def extract_icon_weight_from_settings(settings: Mapping[str, Any] | None) -> str:
    return extract_icon_type_from_settings(settings)


def _contains_icon_setting(settings: Mapping[str, Any]) -> bool:
    if "icon_type" in settings or "icon_weight" in settings:
        return True
    nested_settings = settings.get("settings")
    return isinstance(nested_settings, Mapping) and _contains_icon_setting(
        nested_settings
    )


def extract_icon_type_from_settings(settings: Mapping[str, Any] | None) -> str:
    if not settings:
        return DEFAULT_ICON_TYPE

    nested_settings = settings.get("settings")
    if isinstance(nested_settings, Mapping) and _contains_icon_setting(nested_settings):
        return extract_icon_type_from_settings(nested_settings)

    if "icon_type" in settings:
        return normalize_icon_type(settings.get("icon_type"))

    if "icon_weight" in settings:
        return normalize_icon_type(settings.get("icon_weight"))

    return DEFAULT_ICON_TYPE
