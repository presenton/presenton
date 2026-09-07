"""Helpers for applying generated content to Template V2 element structures."""

from __future__ import annotations

import copy
from collections.abc import Callable
from typing import Any

from .schema import get_repeated_top_level_group_schema_name


def repeated_child_source_index(
    index: int,
    *,
    template_count: int,
    content_count: int,
    center_when_reduced: bool,
) -> int:
    """Return the template child used for a repeated content item."""
    if center_when_reduced and content_count < template_count:
        start = (template_count - content_count) // 2
        return start + index
    return min(index, template_count - 1)


def hydrate_repeated_top_level_groups(
    elements: list[Any],
    content: Any,
    *,
    apply_item: Callable[[dict[str, Any], Any], dict[str, Any]],
) -> list[Any] | None:
    """Map one generated array item to each complete positioned group."""
    if not isinstance(content, dict):
        return None

    field_name = get_repeated_top_level_group_schema_name(elements)
    if field_name is None:
        return None

    values = content.get(field_name)
    if not isinstance(values, list) or not elements:
        return None

    hydrated: list[Any] = []
    for index, value in enumerate(values):
        source_index = repeated_child_source_index(
            index,
            template_count=len(elements),
            content_count=len(values),
            center_when_reduced=True,
        )
        source = copy.deepcopy(elements[source_index])
        if not isinstance(source, dict):
            return None
        hydrated.append(apply_item(source, value))
    return hydrated
