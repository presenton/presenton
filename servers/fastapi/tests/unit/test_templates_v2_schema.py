from templates.v2.models.layouts import RawSlideLayout
from templates.v2.schema import (
    extract_slide_schema_from_layout,
    get_component_schema,
    get_template_schema,
)


def test_extract_slide_schema_from_layout_extracts_editable_content():
    layout = RawSlideLayout.model_validate(
        {
            "id": "content_slide",
            "description": "Editable content with static decoration.",
            "elements": [
                {
                    "type": "vector",
                    "points": [
                        {"x": 0, "y": 0},
                        {"x": 1, "y": 0},
                        {"x": 1, "y": 1},
                        {"x": 0, "y": 1},
                    ],
                    "closed": True,
                    "fill": {"color": "#ffffff"},
                },
                {
                    "type": "text",
                    "decorative": False,
                    "name": "title",
                    "min_length": 4,
                    "max_length": 8,
                    "runs": [{"text": "Title"}],
                },
                {
                    "type": "text",
                    "decorative": True,
                    "name": "static_label",
                    "min_length": 1,
                    "max_length": 2,
                    "runs": [{"text": "A"}],
                },
                {
                    "type": "text",
                    "decorative": False,
                    "name": "formula",
                    "runs": [{"type": "latex", "latex": r"E = mc^2"}],
                    "min_length": 3,
                    "max_length": 120,
                },
                {
                    "type": "image",
                    "decorative": False,
                    "name": "hero_image",
                    "data": "/app_data/images/hero.png",
                    "is_icon": False,
                },
                {
                    "type": "container",
                    "child": {
                        "type": "text",
                        "decorative": False,
                        "name": "caption",
                        "min_length": 2,
                        "max_length": 4,
                        "runs": [{"text": "Caption"}],
                    },
                },
                {
                    "type": "group",
                    "name": "details",
                    "children": [
                        {
                            "type": "text-list",
                            "decorative": False,
                            "name": "bullets",
                            "min_items": 2,
                            "max_items": 4,
                            "min_item_length": 5,
                            "max_item_length": 10,
                            "items": [[{"text": "First bullet"}]],
                        },
                        {
                            "type": "chart",
                            "decorative": False,
                            "name": "chart",
                            "chart_type": "bar",
                            "categories": ["Q1", "Q2"],
                            "series": [{"name": "Revenue", "values": [10, 12]}],
                        },
                    ],
                },
            ],
        }
    )

    assert extract_slide_schema_from_layout(layout) == {
        "type": "object",
        "properties": {
            "title": {"type": "string", "minLength": 4, "maxLength": 8},
            "formula": {"type": "string", "minLength": 3, "maxLength": 120},
            "hero_image": {
                "type": "object",
                "properties": {"image_prompt": {"type": "string"}},
                "required": ["image_prompt"],
                "additionalProperties": False,
            },
            "caption": {"type": "string", "minLength": 2, "maxLength": 4},
            "details": {
                "type": "object",
                "properties": {
                    "bullets": {
                        "type": "array",
                        "minItems": 2,
                        "maxItems": 4,
                        "items": {
                            "type": "string",
                            "minLength": 5,
                            "maxLength": 10,
                        },
                    },
                    "chart": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "chart_type": {
                                "type": "string",
                                "enum": [
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
                                ],
                            },
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
                    },
                },
                "required": ["bullets", "chart"],
                "additionalProperties": False,
            },
        },
        "required": ["title", "formula", "hero_image", "caption", "details"],
        "additionalProperties": False,
    }


def test_extract_slide_schema_from_layout_collapses_repeated_children_to_array():
    layout = RawSlideLayout.model_validate(
        {
            "id": "cards_slide",
            "description": "Repeated card layout.",
            "elements": [
                {
                    "type": "flex",
                    "name": "cards",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 1280, "height": 240},
                    "direction": "row",
                    "min_children": 2,
                    "max_children": 4,
                    "children": [
                        {
                            "type": "group",
                            "name": "card_1",
                            "children": [
                                {
                                    "type": "text",
                                    "decorative": False,
                                    "name": "title_1",
                                    "min_length": 3,
                                    "max_length": 6,
                                    "runs": [{"text": "One"}],
                                },
                                {
                                    "type": "image",
                                    "decorative": False,
                                    "name": "icon_1",
                                    "data": "/app_data/icons/icon-1.svg",
                                    "is_icon": True,
                                },
                            ],
                        },
                        {
                            "type": "group",
                            "name": "card_2",
                            "children": [
                                {
                                    "type": "text",
                                    "decorative": False,
                                    "name": "title_2",
                                    "min_length": 3,
                                    "max_length": 6,
                                    "runs": [{"text": "Two"}],
                                },
                                {
                                    "type": "image",
                                    "decorative": False,
                                    "name": "icon_2",
                                    "data": "/app_data/icons/icon-2.svg",
                                    "is_icon": True,
                                },
                            ],
                        },
                    ],
                }
            ],
        }
    )

    assert extract_slide_schema_from_layout(layout) == {
        "type": "object",
        "properties": {
            "cards": {
                "type": "array",
                "minItems": 2,
                "maxItems": 4,
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string",
                            "minLength": 3,
                            "maxLength": 6,
                        },
                        "icon": {
                            "type": "object",
                            "properties": {"icon_query": {"type": "string"}},
                            "required": ["icon_query"],
                            "additionalProperties": False,
                        },
                    },
                    "required": ["title", "icon"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["cards"],
        "additionalProperties": False,
    }


def test_get_component_schema_extracts_generated_component_content():
    component = {
        "id": "feature_card",
        "description": "Reusable feature card component.",
        "elements": [
            {
                "type": "text",
                "decorative": False,
                "name": "headline",
                "min_length": 4,
                "max_length": 12,
            },
            {
                "type": "image",
                "decorative": False,
                "name": "icon",
                "data": "/app_data/icons/icon.svg",
                "is_icon": True,
            },
            {
                "type": "table",
                "decorative": False,
                "name": "metrics",
                "min_columns": 2,
                "max_columns": 4,
                "min_rows": 1,
                "max_rows": 3,
            },
            {
                "type": "chart",
                "decorative": False,
                "name": "trend",
                "chart_type": "line",
                "categories": ["Q1", "Q2"],
                "series": [{"name": "Revenue", "values": [10, 12]}],
            },
        ],
    }

    assert get_component_schema(component) == {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "title": "feature_card",
        "description": "Reusable feature card component.",
        "additionalProperties": False,
        "properties": {
            "headline": {
                "type": "string",
                "minLength": 4,
                "maxLength": 12,
                "title": "Headline",
                "x-element-type": "text",
                "x-element-path": "elements.0",
            },
            "icon": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "icon_query": {
                        "type": "string",
                        "description": "Search query for the replacement icon.",
                    }
                },
                "required": ["icon_query"],
                "title": "Icon",
                "x-element-type": "image",
                "x-element-path": "elements.1",
            },
            "metrics": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "columns": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": 2,
                        "maxItems": 4,
                    },
                    "rows": {
                        "type": "array",
                        "items": {
                            "type": "array",
                            "items": {"type": "string"},
                            "minItems": 2,
                            "maxItems": 4,
                        },
                        "minItems": 1,
                        "maxItems": 3,
                    },
                },
                "required": ["columns", "rows"],
                "title": "Metrics",
                "x-element-type": "table",
                "x-element-path": "elements.2",
            },
            "trend": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "chart_type": {
                        "type": "string",
                        "enum": [
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
                        ],
                    },
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
                "title": "Trend",
                "x-element-type": "chart",
                "x-element-path": "elements.3",
            },
        },
        "required": ["headline", "icon", "metrics", "trend"],
    }


def test_get_component_schema_extracts_infographic_content_without_vector_content():
    component = {
        "id": "metric_badge",
        "description": "Reusable metric badge component.",
        "elements": [
            {
                "type": "vector",
                "shape": "ellipse",
                "points": [
                    {"x": 0, "y": 40},
                    {"x": 50, "y": 0},
                    {"x": 100, "y": 40},
                    {"x": 50, "y": 80},
                ],
                "closed": True,
            },
            {
                "type": "infographic",
                "decorative": False,
                "name": "progress",
                "data": {
                    "type": "progress_bar",
                    "min_value": 0,
                    "max_value": 100,
                    "value": 64,
                },
                "colors": ["E5E7EB", "2563EB"],
            },
        ],
    }

    schema = get_component_schema(component)
    properties = schema["properties"]

    assert list(properties) == ["progress"]
    assert properties["progress"]["x-element-type"] == "infographic"
    assert properties["progress"]["properties"]["data"]["properties"]["type"] == {
        "const": "progress_bar"
    }
    assert "colors" not in properties["progress"]["properties"]
    assert properties["progress"]["required"] == ["data"]


def test_get_component_schema_preserves_vertical_funnel_type_and_item_limits():
    component = {
        "id": "funnel",
        "description": "A vertically stacked conversion funnel.",
        "elements": [
            {
                "type": "infographic",
                "decorative": False,
                "name": "stages",
                "data": {
                    "type": "vertical_funnel",
                    "items": [{"value": 100, "heading": "Awareness"}],
                },
                "colors": ["FFFFFF", "102E79"],
            }
        ],
    }

    schema = get_component_schema(component)
    data_schema = schema["properties"]["stages"]["properties"]["data"]

    assert data_schema["properties"]["type"] == {"const": "vertical_funnel"}
    assert data_schema["properties"]["items"]["minItems"] == 1
    assert data_schema["properties"]["items"]["maxItems"] == 8


def test_component_table_schema_derives_header_and_body_text_limits():
    def cell(text: str, *, size: int = 14) -> dict:
        font = {"size": size, "color": "#111111"}
        return {"font": font, "runs": [{"text": text, "font": font}]}

    component = {
        "id": "comparison",
        "elements": [
            {
                "type": "table",
                "decorative": False,
                "name": "metrics",
                "min_columns": 2,
                "max_columns": 3,
                "min_rows": 1,
                "max_rows": 4,
                "size": {"width": 600, "height": 300},
                "columns": [cell("Metric"), cell("Value")],
                "rows": [[cell("Activation"), cell("71%")]],
            }
        ],
    }

    schema = get_component_schema(component)
    table_schema = schema["properties"]["metrics"]
    header_schema = table_schema["properties"]["columns"]["items"]
    body_schema = table_schema["properties"]["rows"]["items"]["items"]

    assert header_schema["minLength"] == body_schema["minLength"] == 1
    assert header_schema["maxLength"] >= len("Metric")
    assert body_schema["maxLength"] >= len("Activation")


def test_chart_content_schema_tracks_layout_title_presence():
    without_title = get_component_schema(
        {
            "id": "chart_component",
            "elements": [
                {
                    "type": "chart",
                    "title": None,
                    "decorative": False,
                    "name": "proportion_chart",
                }
            ],
        }
    )["properties"]["proportion_chart"]
    assert "title" not in without_title["properties"]
    assert without_title["required"] == list(without_title["properties"])

    with_title = get_component_schema(
        {
            "id": "chart_component",
            "elements": [
                {
                    "type": "chart",
                    "title": "Revenue by quarter",
                    "decorative": False,
                    "name": "revenue_chart",
                }
            ],
        }
    )["properties"]["revenue_chart"]
    assert with_title["properties"]["title"] == {"type": "string"}
    assert with_title["required"] == list(with_title["properties"])


def test_get_component_schema_collapses_repeated_component_children_to_array():
    component = {
        "id": "card_grid",
        "description": "Reusable card grid component.",
        "elements": [
            {
                "type": "grid",
                "name": "cards",
                "min_children": 2,
                "max_children": 4,
                "children": [
                    {
                        "type": "group",
                        "name": "card_1",
                        "children": [
                            {
                                "type": "text",
                                "decorative": False,
                                "name": "title_1",
                                "min_length": 3,
                                "max_length": 8,
                            }
                        ],
                    },
                    {
                        "type": "group",
                        "name": "card_2",
                        "children": [
                            {
                                "type": "text",
                                "decorative": False,
                                "name": "title_2",
                                "min_length": 3,
                                "max_length": 8,
                            }
                        ],
                    },
                ],
            }
        ],
    }

    schema = get_component_schema(component)

    assert schema is not None
    assert schema["properties"]["cards"] == {
        "type": "array",
        "minItems": 2,
        "maxItems": 4,
        "items": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "title": {
                    "type": "string",
                    "minLength": 3,
                    "maxLength": 8,
                    "title": "Title",
                    "x-element-type": "text",
                }
            },
            "required": ["title"],
        },
    }


def test_get_component_schema_uses_single_flex_child_as_repeated_array_item():
    component = {
        "id": "single_card_list",
        "description": "Reusable list with one visible prototype card.",
        "elements": [
            {
                "type": "flex",
                "name": "cards",
                "min_children": 1,
                "max_children": 2,
                "children": [
                    {
                        "type": "group",
                        "name": "card_1",
                        "children": [
                            {
                                "type": "text",
                                "decorative": False,
                                "name": "title_1",
                                "min_length": 3,
                                "max_length": 8,
                            }
                        ],
                    }
                ],
            }
        ],
    }

    schema = get_component_schema(component)

    assert schema is not None
    assert schema["properties"]["cards"] == {
        "type": "array",
        "minItems": 1,
        "maxItems": 2,
        "items": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "title": {
                    "type": "string",
                    "minLength": 3,
                    "maxLength": 8,
                    "title": "Title",
                    "x-element-type": "text",
                }
            },
            "required": ["title"],
        },
    }


def test_get_component_schema_collapses_group_items_to_bounded_array():
    component = {
        "id": "timeline",
        "description": "Timeline with grouped items.",
        "elements": [
            {
                "type": "group",
                "name": "timeline_items_group",
                "children": [
                    {
                        "type": "group",
                        "name": f"timeline_item_{index}",
                        "children": [
                            {
                                "type": "text",
                                "decorative": False,
                                "name": f"heading_{index}",
                                "min_length": 3,
                                "max_length": 12,
                            }
                        ],
                    }
                    for index in range(1, 4)
                ],
            }
        ],
    }

    schema = get_component_schema(component)

    assert schema is not None
    assert schema["properties"]["timeline_items_group"] == {
        "type": "array",
        "minItems": 1,
        "maxItems": 3,
        "items": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "heading": {
                    "type": "string",
                    "minLength": 3,
                    "maxLength": 12,
                    "title": "Heading",
                    "x-element-type": "text",
                }
            },
            "required": ["heading"],
        },
    }


def test_get_component_schema_collapses_repeated_top_level_groups_to_array():
    component = {
        "id": "metrics",
        "description": "Repeated top-level metric groups.",
        "elements": [
            {
                "type": "group",
                "name": f"metric_group_{index}",
                "children": [
                    {
                        "type": "text",
                        "decorative": False,
                        "name": f"label_{index}",
                        "min_length": 2,
                        "max_length": 8,
                    }
                ],
            }
            for index in range(1, 5)
        ],
    }

    schema = get_component_schema(component)

    assert schema is not None
    assert schema["required"] == ["metric_group"]
    assert schema["properties"]["metric_group"] == {
        "type": "array",
        "minItems": 2,
        "maxItems": 4,
        "items": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "label": {
                    "type": "string",
                    "minLength": 2,
                    "maxLength": 8,
                    "title": "Label",
                    "x-element-type": "text",
                }
            },
            "required": ["label"],
        },
    }


def test_get_template_schema_strips_component_metadata():
    template = {
        "layouts": [
            {
                "id": "intro",
                "description": "Intro slide.",
                "components": [
                    {
                        "id": "hero",
                        "description": "Hero image component.",
                        "elements": [
                            {
                                "type": "image",
                                "decorative": False,
                                "name": "photo",
                                "data": "/app_data/images/photo.png",
                                "is_icon": False,
                            }
                        ],
                    }
                ],
            }
        ]
    }

    assert get_template_schema(template) == {
        "source_file": "template.json",
        "layout_count": 1,
        "layouts": [
            {
                "slide": 1,
                "layout_id": "intro",
                "schema": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "type": "object",
                    "title": "intro",
                    "description": "Intro slide.",
                    "additionalProperties": False,
                    "properties": {
                        "hero": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "photo": {
                                    "type": "object",
                                    "additionalProperties": False,
                                    "properties": {
                                        "image_prompt": {"type": "string"}
                                    },
                                    "required": ["image_prompt"],
                                }
                            },
                            "required": ["photo"],
                        }
                    },
                    "required": ["hero"],
                },
            }
        ],
    }


def test_get_template_schema_numbers_duplicate_component_fields_from_zero():
    template = {
        "layouts": [
            {
                "id": "comparison",
                "description": "Comparison slide.",
                "components": [
                    {
                        "id": "metric_card",
                        "description": "Metric card component.",
                        "elements": [
                            {
                                "type": "text",
                                "decorative": False,
                                "name": "value",
                                "min_length": 1,
                                "max_length": 8,
                            }
                        ],
                    },
                    {
                        "id": "metric_card",
                        "description": "Metric card component.",
                        "elements": [
                            {
                                "type": "text",
                                "decorative": False,
                                "name": "value",
                                "min_length": 1,
                                "max_length": 8,
                            }
                        ],
                    },
                ],
            }
        ]
    }

    schema = get_template_schema(template)["layouts"][0]["schema"]

    assert schema is not None
    assert list(schema["properties"]) == ["metric_card_0", "metric_card_1"]
    assert schema["required"] == ["metric_card_0", "metric_card_1"]
    assert schema["properties"]["metric_card_0"] == schema["properties"]["metric_card_1"]


def _metrics_with_layout_only_wrapper_differences():
    def text(name, value):
        return {
            "type": "text",
            "name": name,
            "decorative": False,
            "min_length": 1,
            "max_length": 60,
            "runs": [{"text": value}],
        }

    def content_children(value, heading, description):
        return [
            text("metric_value", value),
            {
                "type": "flex",
                "name": "metric_text_stack",
                "direction": "column",
                "children": [
                    text("metric_heading", heading),
                    text("metric_description", description),
                ],
            },
        ]

    divider = {
        "type": "vector",
        "decorative": True,
        "points": [{"x": 0, "y": 0}, {"x": 200, "y": 0}],
    }
    return {
        "id": "metrics_panel",
        "elements": [
            {
                "type": "group",
                "name": "metric_items",
                "children": [
                    {
                        "type": "flex",
                        "name": "metric_item_1",
                        "direction": "row",
                        "children": content_children(
                            "68%", "Mobile-first", "Primarily uses mobile"
                        ),
                    },
                    {
                        "type": "flex",
                        "name": "metric_item_2",
                        "direction": "column",
                        "children": [
                            divider,
                            {
                                "type": "flex",
                                "name": "metric_content",
                                "direction": "row",
                                "children": content_children(
                                    "74%", "Research", "Compares products"
                                ),
                            },
                        ],
                    },
                    {
                        "type": "flex",
                        "name": "metric_item_3",
                        "direction": "column",
                        "children": [
                            divider,
                            {
                                "type": "group",
                                "name": "metric_content",
                                "children": content_children(
                                    "32%", "Engagement", "Prefers personalized content"
                                ),
                            },
                        ],
                    },
                ],
            }
        ],
    }


def test_component_schema_flattens_layout_only_repeated_item_wrappers():
    schema = get_component_schema(_metrics_with_layout_only_wrapper_differences())

    metric_items = schema["properties"]["metric_items"]
    assert metric_items["type"] == "array"
    assert metric_items["minItems"] == 1
    assert metric_items["maxItems"] == 3
    assert list(metric_items["items"]["properties"]) == [
        "metric_value",
        "metric_heading",
        "metric_description",
    ]
