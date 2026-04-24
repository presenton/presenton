from typing import Any

from templates.presentation_layout import PresentationLayoutModel

PLACEHOLDER_IMAGE_URL = "/static/images/replaceable_template_image.png"
PLACEHOLDER_ICON_URL = "/static/icons/placeholder.svg"


def build_schema_example(schema: dict) -> Any:
    if not isinstance(schema, dict):
        return None

    if "default" in schema:
        return schema["default"]

    for key in ("anyOf", "oneOf", "allOf"):
        options = schema.get(key)
        if isinstance(options, list):
            for option in options:
                example = build_schema_example(option)
                if example is not None:
                    return example

    enum_values = schema.get("enum")
    if enum_values:
        return enum_values[0]

    schema_type = schema.get("type")
    if schema_type == "object":
        properties = schema.get("properties", {})
        result = {}
        for field_name, field_schema in properties.items():
            result[field_name] = build_schema_example(field_schema)
        return result

    if schema_type == "array":
        items_schema = schema.get("items", {})
        if "default" in schema:
            return schema["default"]
        item_example = build_schema_example(items_schema)
        return [] if item_example is None else [item_example]

    if schema_type == "string":
        schema_description = (schema.get("description") or "").lower()
        if "icon" in schema_description:
            return PLACEHOLDER_ICON_URL
        if "image" in schema_description or "url" in schema_description:
            return PLACEHOLDER_IMAGE_URL
        return "Sample text"

    if schema_type == "integer":
        return schema.get("minimum", 1)

    if schema_type == "number":
        return schema.get("minimum", 1)

    if schema_type == "boolean":
        return False

    return None


def replace_special_placeholders(value: Any) -> Any:
    if isinstance(value, dict):
        result = {}
        for key, child in value.items():
            if key == "__image_url__":
                result[key] = PLACEHOLDER_IMAGE_URL
            elif key == "__icon_url__":
                result[key] = PLACEHOLDER_ICON_URL
            else:
                result[key] = replace_special_placeholders(child)
        return result

    if isinstance(value, list):
        return [replace_special_placeholders(item) for item in value]

    if value == "__image_url__":
        return PLACEHOLDER_IMAGE_URL
    if value == "__icon_url__":
        return PLACEHOLDER_ICON_URL
    return value


def build_template_example(
    template_id: str, layout: PresentationLayoutModel
) -> dict[str, Any]:
    slides = []
    for slide in layout.slides:
        example_content = replace_special_placeholders(
            build_schema_example(slide.json_schema)
        )
        slides.append({"layout": slide.id, "content": example_content})

    return {
        "template": template_id,
        "slides": slides,
    }
