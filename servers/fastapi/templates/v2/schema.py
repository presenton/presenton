"""Create editable content JSON schemas from template v2 slide layouts."""

from __future__ import annotations

import copy
import re
from typing import Any

from utils.infographic_catalog import INFOGRAPHIC_BY_TYPE

from .models.layouts import RawSlideLayout


CONTENT_TYPES = {
    "text",
    "image",
    "text-list",
    "table",
    "chart",
    "infographic",
}
CHART_TYPE_VALUES = [
    "area",
    "bar",
    "bubble",
    "donut",
    "horizontal_bar",
    "horizontal_stacked_bar",
    "line",
    "pie",
    "polar_area",
    "radar",
    "scatter",
    "stacked_bar",
]
REPEATED_NAME_SUFFIX_RE = re.compile(r"_\d+$")
JSON_SCHEMA_URI = "https://json-schema.org/draft/2020-12/schema"
COMPONENT_REPEATED_NAME_TOKEN_RE = re.compile(r"_\d+(?=_|$)")
COMPONENT_SCHEMA_METADATA_KEYS = {
    "$schema",
    "title",
    "description",
    "x-element-type",
    "x-element-path",
}


def _is_editable_element(element: dict[str, Any]) -> bool:
    return element.get("decorative") is False


def extract_slide_schema_from_layout(layout: RawSlideLayout) -> dict[str, Any]:
    """
    Take slide layout and return content schema from slide layout.
    """
    return _object_schema(_properties_schema(layout.elements))


def get_component_schema(component: Any | dict[str, Any]) -> dict[str, Any] | None:
    """
    Return an editable content schema for a generated template component.
    """
    component_data = _component_data(component)
    elements = component_data.get("elements")
    if not isinstance(elements, list):
        raise ValueError("component must contain an elements array")

    properties = _component_schema_properties(elements)
    if not properties:
        return None

    return {
        "$schema": JSON_SCHEMA_URI,
        "type": "object",
        "title": component_data.get("id", "component_content"),
        "description": component_data.get("description"),
        "additionalProperties": False,
        "properties": properties,
        "required": list(properties),
    }


def get_repeated_top_level_group_schema_name(elements: list[Any]) -> str | None:
    """Return the array field name when all component elements form one repeat."""
    node = _component_repeated_top_level_group_node(elements, path="elements")
    return node[0] if node is not None else None


def get_template_schema(
    template_json: Any | dict[str, Any],
    *,
    source_file: str = "template.json",
) -> dict[str, Any]:
    """
    Return editable content schemas for component-based template layouts.
    """
    template_data = _template_data(template_json)
    layouts = template_data.get("layouts")
    if not isinstance(layouts, list):
        raise ValueError("template JSON must contain a layouts array")

    generated_layouts = [
        _template_layout_schema(layout, index)
        for index, layout in enumerate(layouts, start=1)
        if isinstance(layout, dict)
    ]
    return {
        "source_file": source_file,
        "layout_count": len(generated_layouts),
        "layouts": generated_layouts,
    }


def _properties_schema(elements: list[Any]) -> dict[str, Any]:
    properties: dict[str, Any] = {}

    for name, schema in _nodes_for_elements(elements):
        _add_property(properties, name, schema)

    return properties


def _nodes_for_elements(elements: list[Any]) -> list[tuple[str, dict[str, Any]]]:
    nodes: list[tuple[str, dict[str, Any]]] = []

    for value in elements:
        node = _node_for_element_value(value)
        if node is not None:
            nodes.append(node)

    return nodes


def _node_for_element_value(value: Any) -> tuple[str, dict[str, Any]] | None:
    element = _element_dict(value)
    if element is None:
        return None

    return _node_for_element(element)


def _node_for_element(element: dict[str, Any]) -> tuple[str, dict[str, Any]] | None:
    element_type = element.get("type")

    if element_type == "container":
        return _node_for_element_value(element.get("child"))

    if element_type in {"flex", "grid", "group"}:
        children = element.get("children", [])
        if not isinstance(children, list):
            return None

        nodes = _nodes_for_elements(children)
        if not nodes:
            return None

        name = _element_name(element)
        if name is None:
            return None

        if element_type in {"flex", "grid"}:
            array_schema = _array_schema_for_repeated_children(element, children, nodes)
            if array_schema is not None:
                return name, array_schema

        properties: dict[str, Any] = {}
        for child_name, child_schema in nodes:
            _add_property(properties, child_name, child_schema)

        schema = _object_schema(properties)
        if element_type in {"flex", "grid"}:
            schema.update(
                _compact(
                    {
                        "minProperties": element.get("min_children"),
                        "maxProperties": element.get("max_children"),
                    }
                )
            )

        return name, schema

    if element_type not in CONTENT_TYPES or not _is_editable_element(element):
        return None

    name = _element_name(element)
    if name is None:
        return None

    return name, _content_schema_for_element(element)


def _content_schema_for_element(element: dict[str, Any]) -> dict[str, Any]:
    element_type = element["type"]

    if element_type == "text":
        return _compact(
            {
                "type": "string",
                "minLength": element.get("min_length"),
                "maxLength": element.get("max_length"),
            }
        )

    if element_type == "image":
        key = "icon_query" if element.get("is_icon") is True else "image_prompt"
        return _object_schema({key: {"type": "string"}})

    if element_type == "text-list":
        return _compact(
            {
                "type": "array",
                "minItems": element.get("min_items"),
                "maxItems": element.get("max_items"),
                "items": _compact(
                    {
                        "type": "string",
                        "minLength": element.get("min_item_length"),
                        "maxLength": element.get("max_item_length"),
                    }
                ),
            }
        )

    if element_type == "table":
        return _compact(
            {
                "type": "array",
                "minItems": element.get("min_rows"),
                "maxItems": element.get("max_rows"),
                "items": _compact(
                    {
                        "type": "array",
                        "minItems": element.get("min_columns"),
                        "maxItems": element.get("max_columns"),
                        "items": {"type": "string"},
                    }
                ),
            }
        )

    if element_type == "chart":
        return _chart_content_schema()

    if element_type == "infographic":
        return _infographic_content_schema()

    raise ValueError(f"unsupported content element type: {element_type}")


def _array_schema_for_repeated_children(
    element: dict[str, Any],
    children: list[Any],
    nodes: list[tuple[str, dict[str, Any]]],
) -> dict[str, Any] | None:
    if len(nodes) != _element_count(children):
        return None

    if len(nodes) < 2 and not _can_expand_repeated_children(element, len(nodes)):
        return None

    item_schemas = [
        _schema_without_repeated_name_suffix(schema, _repeated_name_suffix(name))
        for name, schema in nodes
    ]
    item_schema = _component_merge_repeated_schemas(item_schemas)
    if item_schema is None:
        return None

    return _compact(
        {
            "type": "array",
            "minItems": element.get("min_children"),
            "maxItems": element.get("max_children"),
            "items": item_schema,
        }
    )


def _object_schema(
    properties: dict[str, Any],
    *,
    required: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": properties,
        "required": list(properties) if required is None else required,
        "additionalProperties": False,
    }


def _element_name(element: dict[str, Any]) -> str | None:
    name = element.get("name")
    if not isinstance(name, str):
        return None

    stripped = name.strip()
    return stripped or None


def _add_property(
    properties: dict[str, Any],
    name: str,
    schema: dict[str, Any],
) -> None:
    key = name
    suffix = 2

    while key in properties:
        key = f"{name}_{suffix}"
        suffix += 1

    properties[key] = schema


def _schema_without_repeated_name_suffix(
    schema: dict[str, Any],
    suffix: str | None,
) -> dict[str, Any]:
    if schema.get("type") != "object":
        return {
            key: _normalize_schema_value(value, suffix)
            for key, value in schema.items()
        }

    properties = schema.get("properties")
    if not isinstance(properties, dict):
        return {
            key: _normalize_schema_value(value, suffix)
            for key, value in schema.items()
        }

    normalized_properties: dict[str, Any] = {}
    name_map: dict[str, str] = {}

    for key, value in properties.items():
        normalized_key = _strip_repeated_suffix(key, suffix)
        name_map[key] = normalized_key
        normalized_properties[normalized_key] = _normalize_schema_value(value, suffix)

    normalized_schema = {
        key: _normalize_schema_value(value, suffix)
        for key, value in schema.items()
        if key not in {"properties", "required"}
    }
    normalized_schema["properties"] = normalized_properties

    required = schema.get("required")
    if isinstance(required, list):
        normalized_schema["required"] = [
            name_map.get(item, _strip_repeated_suffix(item, suffix))
            for item in required
            if isinstance(item, str)
        ]

    return normalized_schema


def _normalize_schema_value(value: Any, suffix: str | None) -> Any:
    if isinstance(value, dict):
        return _schema_without_repeated_name_suffix(value, suffix)

    if isinstance(value, list):
        return [_normalize_schema_value(item, suffix) for item in value]

    return value


def _repeated_name_suffix(value: str) -> str | None:
    match = REPEATED_NAME_SUFFIX_RE.search(value)
    return match.group(0) if match else None


def _strip_repeated_suffix(value: str, suffix: str | None) -> str:
    if suffix and value.endswith(suffix):
        return value[: -len(suffix)]

    return value


def _element_count(values: list[Any]) -> int:
    return sum(1 for value in values if _element_dict(value) is not None)


def _can_expand_repeated_children(element: dict[str, Any], child_count: int) -> bool:
    max_children = element.get("max_children")
    return isinstance(max_children, (int, float)) and max_children > child_count


def _compact(value: dict[str, Any]) -> dict[str, Any]:
    return {key: item for key, item in value.items() if item is not None}


def _element_dict(value: Any) -> dict[str, Any] | None:
    if isinstance(value, dict):
        return value

    model_dump = getattr(value, "model_dump", None)
    if not callable(model_dump):
        return None

    dumped = model_dump(mode="json")
    if isinstance(dumped, dict):
        return dumped

    return None


def _template_layout_schema(layout: dict[str, Any], slide_index: int) -> dict[str, Any]:
    properties: dict[str, Any] = {}
    required: list[str] = []

    components = layout.get("components")
    if not isinstance(components, list):
        components = []

    component_entries: list[tuple[str, dict[str, Any]]] = []
    for component in components:
        component_data = _component_data_or_none(component)
        if component_data is None:
            continue

        component_schema = get_component_schema(component_data)
        if component_schema is None:
            continue

        component_entries.append((_component_id(component_data), component_schema))

    component_counts: dict[str, int] = {}
    for component_id, _schema in component_entries:
        component_counts[component_id] = component_counts.get(component_id, 0) + 1

    component_indexes: dict[str, int] = {}
    for component_id, component_schema in component_entries:
        component_index = component_indexes.get(component_id, 0)
        component_indexes[component_id] = component_index + 1

        key = _template_component_key(
            component_id,
            occurrence_index=component_index,
            occurrence_count=component_counts[component_id],
            properties=properties,
        )
        properties[key] = _component_schema_for_template(component_schema)
        required.append(key)

    schema = None
    if properties:
        schema = {
            "$schema": JSON_SCHEMA_URI,
            "type": "object",
            "title": layout.get("id") or f"slide_{slide_index}",
            "description": layout.get("description"),
            "additionalProperties": False,
            "properties": properties,
            "required": required,
        }

    return {
        "slide": slide_index,
        "layout_id": layout.get("id"),
        "schema": schema,
    }


def _component_schema_for_template(component_schema: dict[str, Any]) -> dict[str, Any]:
    schema = _strip_component_schema_metadata(copy.deepcopy(component_schema))
    return schema if isinstance(schema, dict) else component_schema


def _strip_component_schema_metadata(value: Any) -> Any:
    if isinstance(value, list):
        return [_strip_component_schema_metadata(item) for item in value]

    if not isinstance(value, dict):
        return value

    stripped: dict[str, Any] = {}
    for key, nested in value.items():
        if key in COMPONENT_SCHEMA_METADATA_KEYS:
            continue

        if key == "properties" and isinstance(nested, dict):
            stripped[key] = {
                property_name: _strip_component_schema_metadata(property_schema)
                for property_name, property_schema in nested.items()
            }
            continue

        stripped[key] = _strip_component_schema_metadata(nested)

    return stripped


def _template_component_key(
    component_id: str,
    *,
    occurrence_index: int,
    occurrence_count: int,
    properties: dict[str, Any],
) -> str:
    key = (
        f"{component_id}_{occurrence_index}"
        if occurrence_count > 1
        else component_id
    )
    suffix = 1
    unique_key = key
    while unique_key in properties:
        unique_key = f"{key}_{suffix}"
        suffix += 1
    return unique_key


def _component_data(component: Any | dict[str, Any]) -> dict[str, Any]:
    component_data = _component_data_or_none(component)
    if component_data is not None:
        return component_data
    raise ValueError("component must be a Component or JSON object")


def _component_data_or_none(value: Any) -> dict[str, Any] | None:
    if isinstance(value, dict):
        return copy.deepcopy(value)

    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        dumped = model_dump(mode="json")
        if isinstance(dumped, dict):
            return dumped

    return None


def _template_data(template_json: Any | dict[str, Any]) -> dict[str, Any]:
    if isinstance(template_json, dict):
        return copy.deepcopy(template_json)

    model_dump = getattr(template_json, "model_dump", None)
    if callable(model_dump):
        dumped = model_dump(mode="json")
        if isinstance(dumped, dict):
            return dumped

    raise ValueError("template JSON must be a JSON object")


def _component_id(component_data: dict[str, Any]) -> str:
    component_id = component_data.get("id")
    if isinstance(component_id, str):
        return component_id
    raise ValueError("component must include a string id")


def _component_schema_properties(elements: list[Any]) -> dict[str, Any]:
    properties: dict[str, Any] = {}
    for name, schema in _component_schema_nodes_for_elements(elements):
        _component_add_schema_property(properties, name, schema)
    return properties


def _component_schema_nodes_for_elements(
    elements: list[Any],
    *,
    path: str = "elements",
) -> list[tuple[str, dict[str, Any]]]:
    repeated_top_level_groups = _component_repeated_top_level_group_node(
        elements,
        path=path,
    )
    if repeated_top_level_groups is not None:
        return [repeated_top_level_groups]

    nodes: list[tuple[str, dict[str, Any]]] = []
    for index, element in enumerate(elements):
        if isinstance(element, dict):
            nodes.extend(
                _component_schema_nodes_for_element(
                    element,
                    path=f"{path}.{index}",
                )
            )
    return nodes


def _component_schema_nodes_for_element(
    element: dict[str, Any],
    *,
    path: str,
) -> list[tuple[str, dict[str, Any]]]:
    element_type = element.get("type")
    name = _component_schema_element_name(element)

    if (
        element_type in CONTENT_TYPES
        and _is_editable_element(element)
        and name is not None
    ):
        return [
            (
                name,
                _component_content_field_schema(
                    {"name": name, "path": path, "element": element}
                ),
            )
        ]

    if element_type == "container":
        child = element.get("child")
        child_nodes = (
            _component_schema_nodes_for_element(child, path=f"{path}.child")
            if isinstance(child, dict)
            else []
        )
        if name is None or not child_nodes:
            return child_nodes
        return [(name, _component_object_schema_from_nodes(child_nodes))]

    if element_type in {"flex", "grid", "group"}:
        children = element.get("children")
        if not isinstance(children, list):
            return []

        child_node_sets = [
            _component_schema_nodes_for_element(child, path=f"{path}.children.{index}")
            if isinstance(child, dict)
            else []
            for index, child in enumerate(children)
        ]
        child_nodes = [
            node
            for node_set in child_node_sets
            for node in node_set
        ]
        if name is None or not child_nodes:
            return child_nodes

        supports_repeated_children = element_type in {"flex", "grid"} or (
            element_type == "group"
            and all(
                isinstance(child, dict) and child.get("type") == "group"
                for child in children
            )
        )
        if supports_repeated_children:
            array_schema = _component_array_schema_for_repeated_children(
                element,
                child_node_sets,
            )
            if array_schema is not None:
                return [(name, array_schema)]

        return [(name, _component_object_schema_from_nodes(child_nodes))]

    return []


def _component_repeated_top_level_group_node(
    elements: list[Any],
    *,
    path: str,
) -> tuple[str, dict[str, Any]] | None:
    groups = [element for element in elements if isinstance(element, dict)]
    if (
        len(groups) != len(elements)
        or not groups
        or any(group.get("type") != "group" for group in groups)
    ):
        return None

    node_sets = [
        _component_schema_nodes_for_element(group, path=f"{path}.{index}")
        for index, group in enumerate(groups)
    ]
    result = _component_repeated_children_schema_result(
        {"type": "group", "children": groups},
        node_sets,
    )
    if result is None or not node_sets[0]:
        return None

    schema, strategy = result
    first_name = node_sets[0][0][0]
    token = _component_normalization_token_for_nodes(
        node_sets[0],
        strategy=strategy,
    )
    return _component_strip_repeated_suffix(first_name, token), schema


def _component_schema_element_name(element: dict[str, Any]) -> str | None:
    name = element.get("name")
    if not isinstance(name, str):
        return None
    stripped = name.strip()
    return stripped or None


def _component_object_schema_from_nodes(
    nodes: list[tuple[str, dict[str, Any]]],
) -> dict[str, Any]:
    properties: dict[str, Any] = {}
    for name, schema in nodes:
        _component_add_schema_property(properties, name, schema)
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": properties,
        "required": list(properties),
    }


def _component_add_schema_property(
    properties: dict[str, Any],
    name: str,
    schema: dict[str, Any],
) -> None:
    key = name
    suffix = 2
    while key in properties:
        key = f"{name}_{suffix}"
        suffix += 1
    properties[key] = schema


def _component_array_schema_for_repeated_children(
    element: dict[str, Any],
    child_node_sets: list[list[tuple[str, dict[str, Any]]]],
) -> dict[str, Any] | None:
    result = _component_repeated_children_schema_result(element, child_node_sets)
    return result[0] if result is not None else None


def _component_repeated_children_schema_result(
    element: dict[str, Any],
    child_node_sets: list[list[tuple[str, dict[str, Any]]]],
) -> tuple[dict[str, Any], str] | None:
    populated_node_sets = [node_set for node_set in child_node_sets if node_set]
    if len(populated_node_sets) != len(child_node_sets):
        return None

    if len(populated_node_sets) < 2 and not _can_expand_repeated_children(
        element,
        len(populated_node_sets),
    ):
        return None

    for strategy in ("numeric", "none", "prefix"):
        normalized_item_schemas = [
            _component_normalized_repeated_item_schema(node_set, strategy=strategy)
            for node_set in populated_node_sets
        ]
        merged_item_schema = _component_merge_repeated_schemas(
            normalized_item_schemas
        )
        if merged_item_schema is not None:
            min_items, max_items = _component_repeated_item_limits(
                element,
                len(child_node_sets),
            )
            return (
                _without_none_values(
                    {
                        "type": "array",
                        "minItems": min_items,
                        "maxItems": max_items,
                        "items": merged_item_schema,
                    }
                ),
                strategy,
            )

    return None


def _component_repeated_item_limits(
    element: dict[str, Any],
    item_count: int,
) -> tuple[Any, Any]:
    if element.get("type") != "group":
        return element.get("min_children"), element.get("max_children")

    return item_count // 2, item_count


def _component_normalized_repeated_item_schema(
    nodes: list[tuple[str, dict[str, Any]]],
    *,
    strategy: str,
) -> dict[str, Any]:
    token = _component_normalization_token_for_nodes(nodes, strategy=strategy)
    item_schema = (
        nodes[0][1]
        if len(nodes) == 1 and nodes[0][1].get("type") == "object"
        else _component_object_schema_from_nodes(nodes)
    )
    normalized = _component_schema_without_repeated_name_suffix(item_schema, token)
    if (
        token
        and len(nodes) == 1
        and isinstance(normalized, dict)
        and isinstance(normalized.get("title"), str)
    ):
        normalized["title"] = _component_content_field_title(
            _component_strip_repeated_suffix(nodes[0][0], token)
        )
    return normalized


def _component_normalization_token_for_nodes(
    nodes: list[tuple[str, dict[str, Any]]],
    *,
    strategy: str,
) -> str | None:
    if strategy == "none":
        return None

    token_getter = (
        _component_numeric_name_token
        if strategy == "numeric"
        else _component_prefix_name_token
    )
    tokens = [token_getter(name) for name, _schema in nodes]
    tokens = [token for token in tokens if token is not None]
    if not tokens:
        return None

    first_token = tokens[0]
    if all(token == first_token for token in tokens):
        return first_token
    return None


def _component_numeric_name_token(value: str) -> str | None:
    match = COMPONENT_REPEATED_NAME_TOKEN_RE.search(value)
    return match.group(0) if match else None


def _component_prefix_name_token(value: str) -> str | None:
    token, separator, _rest = value.partition("_")
    if not separator or not token:
        return None
    return f"{token}_"


def _component_schema_without_repeated_name_suffix(
    schema: dict[str, Any],
    suffix: str | None,
) -> dict[str, Any]:
    normalized = _component_normalize_schema_value(schema, suffix)
    return normalized if isinstance(normalized, dict) else schema


def _component_normalize_schema_value(value: Any, suffix: str | None) -> Any:
    if isinstance(value, list):
        return [_component_normalize_schema_value(item, suffix) for item in value]

    if not isinstance(value, dict):
        return value

    normalized: dict[str, Any] = {}
    for key, nested in value.items():
        if key == "x-element-path":
            continue

        if key == "properties" and isinstance(nested, dict):
            properties: dict[str, Any] = {}
            for property_name, property_schema in nested.items():
                normalized_name = _component_strip_repeated_suffix(
                    property_name,
                    suffix,
                )
                normalized_schema = _component_normalize_schema_value(
                    property_schema,
                    suffix,
                )
                if isinstance(normalized_schema, dict) and "title" in normalized_schema:
                    normalized_schema["title"] = _component_content_field_title(
                        normalized_name
                    )
                properties[normalized_name] = normalized_schema
            normalized[key] = properties
            continue

        if key == "required" and isinstance(nested, list):
            normalized[key] = [
                _component_strip_repeated_suffix(item, suffix)
                for item in nested
                if isinstance(item, str)
            ]
            continue

        normalized[key] = _component_normalize_schema_value(nested, suffix)

    return normalized


def _component_strip_repeated_suffix(value: str, suffix: str | None) -> str:
    if suffix and suffix in value:
        return value.replace(suffix, "", 1)
    return value


def _component_merge_repeated_schemas(
    schemas: list[dict[str, Any]],
) -> dict[str, Any] | None:
    if not schemas:
        return None

    first = _component_comparable_repeated_schema(schemas[0])
    if any(_component_comparable_repeated_schema(schema) != first for schema in schemas):
        return None

    return _without_none_values(copy.deepcopy(schemas[0]))


def _component_comparable_repeated_schema(value: Any, key: str = "") -> Any:
    if isinstance(value, list):
        items = [_component_comparable_repeated_schema(item) for item in value]
        if key in {"enum", "required"} and all(isinstance(item, str) for item in items):
            return sorted(items)
        return items

    if not isinstance(value, dict):
        return value

    comparable: dict[str, Any] = {}
    for nested_key in sorted(value):
        if nested_key == "x-element-path":
            continue
        comparable[nested_key] = _component_comparable_repeated_schema(
            value[nested_key],
            nested_key,
        )
    return comparable


def _component_content_field_schema(field: dict[str, Any]) -> dict[str, Any]:
    element = field["element"]
    element_type = element.get("type")
    schema: dict[str, Any]

    if element_type == "text":
        schema = {
            "type": "string",
            "minLength": element.get("min_length"),
            "maxLength": element.get("max_length"),
        }
    elif element_type == "image":
        prompt_key = _component_image_prompt_key(element)
        schema = {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                prompt_key: {
                    "type": "string",
                    "description": _component_image_prompt_description(element),
                }
            },
            "required": [prompt_key],
        }
    elif element_type == "text-list":
        schema = {
            "type": "array",
            "items": {
                "type": "string",
                "minLength": element.get("min_item_length"),
                "maxLength": element.get("max_item_length"),
            },
            "minItems": element.get("min_items"),
            "maxItems": element.get("max_items"),
        }
    elif element_type == "table":
        schema = {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "columns": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": element.get("min_columns"),
                    "maxItems": element.get("max_columns"),
                },
                "rows": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": element.get("min_columns"),
                        "maxItems": element.get("max_columns"),
                    },
                    "minItems": element.get("min_rows"),
                    "maxItems": element.get("max_rows"),
                },
            },
            "required": ["columns", "rows"],
        }
    elif element_type == "chart":
        schema = _chart_content_schema()
    elif element_type == "infographic":
        schema = _infographic_content_schema()
    else:
        schema = {}

    return {
        **_without_none_values(schema),
        "title": _component_content_field_title(field["name"]),
        "x-element-type": element_type,
        "x-element-path": field["path"],
    }


def _infographic_text_item_schema(*, hierarchy: bool = False) -> dict[str, Any]:
    properties: dict[str, Any] = {
        "heading": {"type": "string"},
        "description": {"type": "string"},
        "label": {"type": "string"},
        "focus": {"type": "string"},
        "icon": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "url": {"type": "string"},
                "color": {"type": "string"},
            },
            "required": ["url", "color"],
        },
    }
    if hierarchy:
        properties.update(
            {
                "id": {"type": "string"},
                "parent_id": {"type": ["string", "null"]},
            }
        )
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": properties,
        **({"required": ["id", "heading"]} if hierarchy else {}),
    }


def _infographic_data_content_schema(infographic_type: str) -> dict[str, Any]:
    properties: dict[str, Any] = {"type": {"const": infographic_type}}
    required = ["type"]

    if infographic_type in {"progress_bar", "gauge"}:
        properties.update(
            {
                "min_value": {"type": "number"},
                "max_value": {"type": "number"},
                "value": {"type": "number"},
            }
        )
        required.extend(["min_value", "max_value", "value"])
    elif infographic_type == "gantt":
        position = {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "column": {"type": "integer", "minimum": 0},
                "offset": {"type": "number", "minimum": 0, "maximum": 1},
            },
            "required": ["column", "offset"],
        }
        properties.update(
            {
                "columns": {
                    "type": "array",
                    "minItems": 1,
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {"label": {"type": "string"}},
                        "required": ["label"],
                    },
                },
                "rows": {
                    "type": "array",
                    "minItems": 1,
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "label": {"type": "string"},
                            "items": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "additionalProperties": False,
                                    "properties": {
                                        "name": {"type": "string"},
                                        "start": position,
                                        "end": position,
                                    },
                                    "required": ["name", "start", "end"],
                                },
                            },
                        },
                        "required": ["label", "items"],
                    },
                },
            }
        )
        required.extend(["columns", "rows"])
    elif infographic_type == "comparison_matrix":
        item_schema = _infographic_text_item_schema()
        item_schema["properties"]["values"] = {
            "type": "array",
            "items": {"type": "string"},
        }
        item_schema["required"] = ["heading", "values"]
        properties.update(
            {
                "criteria": {
                    "type": "array",
                    "minItems": 1,
                    "items": {"type": "string"},
                },
                "items": {"type": "array", "minItems": 1, "items": item_schema},
            }
        )
        required.extend(["criteria", "items"])
    else:
        hierarchy = infographic_type in {"org_chart", "decision_tree"}
        item_schema = _infographic_text_item_schema(hierarchy=hierarchy)
        if infographic_type == "conversion_funnel":
            item_schema["properties"]["value"] = {"type": "number"}
            item_schema["required"] = ["value", "heading"]
        if infographic_type == "mind_map":
            item_schema["properties"]["items"] = {
                "type": "array",
                "items": _infographic_text_item_schema(),
            }
        properties["items"] = {
            "type": "array",
            "minItems": 1,
            "items": item_schema,
        }
        required.append("items")
        for field_name in {
            "pillar_framework": ("title",),
            "transformation_hub": ("center_label",),
            "risk_matrix": ("center_label",),
            "before_after": ("before_label", "after_label"),
            "impact_effort_matrix": (
                "x_axis_label",
                "y_axis_label",
                "low_label",
                "high_label",
            ),
        }.get(infographic_type, ()):
            properties[field_name] = {"type": "string"}
            required.append(field_name)
        if infographic_type == "radial_cycle":
            properties["center_image"] = {"type": ["string", "null"]}
        if infographic_type == "customer_journey":
            properties["start_color"] = {"type": ["string", "null"]}

    return {
        "type": "object",
        "additionalProperties": False,
        "properties": properties,
        "required": required,
    }


def _infographic_content_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "data": {
                "oneOf": [
                    _infographic_data_content_schema(infographic_type)
                    for infographic_type in INFOGRAPHIC_BY_TYPE
                ]
            },
            "colors": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 1,
            },
        },
        "required": ["data"],
    }


def _without_none_values(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: _without_none_values(nested)
            for key, nested in value.items()
            if nested is not None
        }
    if isinstance(value, list):
        return [_without_none_values(item) for item in value]
    return value


def _chart_content_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "chart_type": {
                "type": "string",
                "enum": CHART_TYPE_VALUES,
            },
            "title": {"type": ["string", "null"]},
            "categories": {
                "type": "array",
                "items": {"type": "string"},
                "maxItems": 24,
            },
            "series": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "name": {"type": "string"},
                        "values": {
                            "type": "array",
                            "items": {"type": "number"},
                            "maxItems": 24,
                        },
                    },
                    "required": ["name", "values"],
                },
                "maxItems": 12,
            },
        },
        "required": ["chart_type", "categories", "series"],
    }


def _component_content_field_title(name: str) -> str:
    return " ".join(part.capitalize() for part in name.split("_") if part) or name


def _component_image_prompt_key(element: dict[str, Any]) -> str:
    return "icon_query" if element.get("is_icon") is True else "image_prompt"


def _component_image_prompt_description(element: dict[str, Any]) -> str:
    if element.get("is_icon") is True:
        return "Search query for the replacement icon."
    return "Prompt for the replacement image."
