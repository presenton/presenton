import json

import pytest

from templates.v2 import certified_generation as generation
from templates.v2.generation import generate_slide_layout


def _raw_layout():
    return generation.RawSlideLayout.model_validate(
        {
            "id": "metrics_grid",
            "description": "Metric cards arranged in a regular two by two grid.",
            "elements": [
                {
                    "type": "vector",
                    "shape": "polygon",
                    "closed": True,
                    "points": [
                        {"x": 0, "y": 0},
                        {"x": 1280, "y": 0},
                        {"x": 1280, "y": 720},
                        {"x": 0, "y": 720},
                    ],
                    "fill": {"color": "#F7F7F7"},
                },
                *[
                    {
                        "type": "group",
                        "name": f"metric_card_{index + 1}",
                        "position": {
                            "x": 100 + (index % 2) * 250,
                            "y": 150 + (index // 2) * 200,
                        },
                        "size": {"width": 200, "height": 140},
                        "children": [
                            {
                                "type": "text",
                                "position": {"x": 10, "y": 10},
                                "size": {"width": 180, "height": 40},
                                "font": {"size": 28, "color": "#123456"},
                                "runs": [{"text": f"Metric {index + 1}"}],
                                "decorative": True,
                                "name": f"metric_{index + 1}",
                                "min_length": 4,
                                "max_length": 20,
                            }
                        ],
                    }
                    for index in range(4)
                ],
            ],
        }
    )


def _manifest():
    return generation.SemanticSlideManifest.model_validate(
        {
            "id": "title_metrics_grid",
            "description": (
                "Reusable metric cards arranged in a balanced grid below the "
                "slide background."
            ),
            "components": [
                {
                    "id": "background",
                    "description": "Fixed full-slide background visual scaffolding.",
                    "element_indices": [0],
                    "repeated_items": None,
                },
                {
                    "id": "metrics",
                    "description": (
                        "Dynamic metric cards arranged in a balanced two-column region."
                    ),
                    "element_indices": [1, 2, 3, 4],
                    "repeated_items": None,
                },
            ],
            "annotations": [
                {
                    "path": f"elements.{index}.children.0",
                    "name": "metric_value",
                    "decorative": False,
                }
                for index in range(1, 5)
            ],
        }
    )


def _flexible_plan():
    return generation.FlexibleSlidePlan.model_validate(
        {
            "regions": [
                {
                    "component_id": "metrics",
                    "root_flow_id": "metric_cards",
                    "flows": [
                        {
                            "id": "metric_cards",
                            "name": "metric_cards",
                            "mode": "grid",
                            "items": [
                                {"indices": [index], "flow_id": None}
                                for index in range(1, 5)
                            ],
                        }
                    ],
                }
            ]
        }
    )


def test_certified_compiler_builds_dynamic_grid():
    raw_layout = _raw_layout()
    manifest = _manifest()
    flexible_plan = _flexible_plan()
    source_elements = raw_layout.model_dump(mode="json")["elements"]

    generation._validate_flexible_plan(
        flexible_plan,
        manifest=manifest,
        source_elements=source_elements,
    )
    layout = generation._compile_semantic_layout(
        raw_layout,
        manifest,
        flexible_plan,
        generation.TextCapacityPlan(adjustments=[]),
    )

    grid = layout.components[1].elements[0]
    assert grid.type == "grid"
    assert grid.name == "metric_cards"
    assert grid.columns == 2
    assert grid.rows == 2
    assert grid.min_children == 2
    assert grid.max_children == 4
    assert all(
        child.children[0].children[0].name == "metric_value"
        for child in grid.children
    )


def test_flexible_validation_preserves_explicit_group_for_regular_geometry():
    raw_layout = _raw_layout()
    manifest = _manifest()
    flexible_plan = _flexible_plan()
    flexible_plan.regions[0].flows[0].mode = "group"
    source_elements = raw_layout.model_dump(mode="json")["elements"]

    generation._validate_flexible_plan(
        flexible_plan,
        manifest=manifest,
        source_elements=source_elements,
    )

    assert flexible_plan.regions[0].flows[0].mode == "group"
    layout = generation._compile_semantic_layout(
        raw_layout,
        manifest,
        flexible_plan,
        generation.TextCapacityPlan(adjustments=[]),
    )
    assert layout.components[1].elements[0].type == "group"


def test_flexible_validation_downgrades_invalid_geometry_to_group():
    raw_layout = _raw_layout()
    manifest = _manifest()
    flexible_plan = generation.FlexibleSlidePlan.model_validate(
        {
            "regions": [
                {
                    "component_id": "metrics",
                    "root_flow_id": "metric_cards",
                    "flows": [
                        {
                            "id": "metric_cards",
                            "name": "metric_cards",
                            "mode": "row",
                            "items": [
                                {"indices": [1], "flow_id": None},
                                {"indices": [2, 3, 4], "flow_id": None},
                            ],
                        }
                    ],
                }
            ]
        }
    )
    source_elements = raw_layout.model_dump(mode="json")["elements"]

    generation._validate_flexible_plan(
        flexible_plan,
        manifest=manifest,
        source_elements=source_elements,
    )

    assert flexible_plan.regions[0].flows[0].mode == "group"
    layout = generation._compile_semantic_layout(
        raw_layout,
        manifest,
        flexible_plan,
        generation.TextCapacityPlan(adjustments=[]),
    )
    assert layout.components[1].elements[0].type == "group"


def test_certified_compiler_preserves_source_stack_across_components():
    raw_layout = generation.RawSlideLayout.model_validate(
        {
            "id": "layered_title",
            "description": "A title rendered above a full-slide background panel.",
            "elements": [
                {
                    "type": "vector",
                    "shape": "polygon",
                    "closed": True,
                    "points": [
                        {"x": 0, "y": 0},
                        {"x": 1280, "y": 0},
                        {"x": 1280, "y": 720},
                        {"x": 0, "y": 720},
                    ],
                    "fill": {"color": "#FFFFFF"},
                },
                {
                    "type": "image",
                    "position": {"x": 80, "y": 140},
                    "size": {"width": 528, "height": 548},
                    "data": "/static/images/replaceable_template_image.png",
                    "decorative": True,
                    "name": "panel_image",
                    "is_icon": False,
                },
                {
                    "type": "text",
                    "position": {"x": 80, "y": 48},
                    "size": {"width": 1121, "height": 61},
                    "font": {"size": 60, "color": "#111827", "bold": True},
                    "runs": [{"text": "Signature Menu Items"}],
                    "decorative": True,
                    "name": "title",
                    "min_length": 10,
                    "max_length": 40,
                },
            ],
        }
    )
    manifest = generation.SemanticSlideManifest.model_validate(
        {
            "id": "image_panel_with_header",
            "description": "A full-slide image panel with a prominent title above it.",
            # Reading-order output puts the title first even though the panel
            # owns the source slide's bottom-most layers.
            "components": [
                {
                    "id": "slide_header",
                    "description": "Prominent title at the top of the slide.",
                    "element_indices": [2],
                    "repeated_items": None,
                },
                {
                    "id": "feature_image_panel",
                    "description": "Full-slide background and supporting image panel.",
                    "element_indices": [0, 1],
                    "repeated_items": None,
                },
            ],
            "annotations": [
                {
                    "path": "elements.1",
                    "name": "panel_image",
                    "decorative": False,
                    "is_icon": False,
                },
                {
                    "path": "elements.2",
                    "name": "title",
                    "decorative": False,
                },
            ],
        }
    )

    layout = generation._compile_semantic_layout(
        raw_layout,
        manifest,
        generation.FlexibleSlidePlan(regions=[]),
        generation.TextCapacityPlan(adjustments=[]),
    )

    assert [component.id for component in layout.components] == [
        "feature_image_panel",
        "slide_header",
    ]
    assert layout.components[1].elements[0].runs[0].text == "Signature Menu Items"


def test_group_compilation_preserves_text_bounds_over_decorative_surface():
    raw_layout = generation.RawSlideLayout.model_validate(
        {
            "id": "icon_badge",
            "description": "A pill badge containing an icon and text.",
            "elements": [
                {
                    "type": "vector",
                    "shape": "polygon",
                    "closed": True,
                    "points": [
                        {"x": 100, "y": 50},
                        {"x": 300, "y": 50},
                        {"x": 300, "y": 100},
                        {"x": 100, "y": 100},
                    ],
                    "fill": {"color": "#D6FF3F"},
                },
                {
                    "type": "image",
                    "position": {"x": 125, "y": 65},
                    "size": {"width": 20, "height": 20},
                    "data": "/static/icons/placeholder.svg",
                    "decorative": True,
                    "name": "badge_icon",
                    "is_icon": True,
                },
                {
                    "type": "text",
                    "position": {"x": 165, "y": 60},
                    "size": {"width": 120, "height": 30},
                    "font": {"size": 20, "color": "#292929"},
                    "runs": [{"text": "The Brand"}],
                    "decorative": True,
                    "name": "badge_text",
                    "min_length": 4,
                    "max_length": 9,
                },
            ],
        }
    )
    manifest = generation.SemanticSlideManifest.model_validate(
        {
            "id": "icon_badge",
            "description": "A pill badge containing an icon and text.",
            "components": [
                {
                    "id": "badge",
                    "description": "The icon and text badge.",
                    "element_indices": [0, 1, 2],
                    "repeated_items": None,
                }
            ],
            "annotations": [
                {
                    "path": "elements.1",
                    "name": "badge_icon",
                    "decorative": False,
                    "is_icon": True,
                },
                {
                    "path": "elements.2",
                    "name": "badge_text",
                    "decorative": False,
                },
            ],
        }
    )
    flexible_plan = generation.FlexibleSlidePlan.model_validate(
        {
            "regions": [
                {
                    "component_id": "badge",
                    "root_flow_id": "badge_group",
                    "flows": [
                        {
                            "id": "badge_group",
                            "name": "badge_group",
                            "mode": "group",
                            "items": [
                                {"indices": [0], "flow_id": None},
                                {"indices": [1], "flow_id": None},
                                {"indices": [2], "flow_id": None},
                            ],
                        }
                    ],
                }
            ]
        }
    )

    layout = generation._compile_semantic_layout(
        raw_layout,
        manifest,
        flexible_plan,
        generation.TextCapacityPlan(adjustments=[]),
    )

    group = layout.components[0].elements[0]
    text = group.children[2]
    assert text.position.x == 65
    assert text.position.y == 10
    assert text.size.width == 120
    assert text.size.height == 30


@pytest.mark.parametrize("mode", ["row", "column"])
def test_fixed_flow_sizing_does_not_rewrite_text_size(mode):
    children = [
        {"type": "text", "size": {"width": 120, "height": 30}},
        {"type": "image", "size": {"width": 120, "height": 30}},
    ]
    bounds = [
        {"x": 0, "y": 0, "width": 120, "height": 30},
        {"x": 140, "y": 0, "width": 120, "height": 30},
    ]

    generation._apply_fixed_flow_child_sizing(
        children,
        bounds,
        [True, True],
        mode=mode,
        cross_size=240,
        align_items="flex-start",
    )

    assert children[0]["size"] == {"width": 120, "height": 30}
    if mode == "row":
        assert "size" not in children[1]
    else:
        assert children[1]["size"] == {"width": 240, "height": 30}


def test_llm_text_capacity_expansion_recalculates_text_limits():
    elements = [
        {
            "type": "text",
            "position": {"x": 100, "y": 100},
            "size": {"width": 100, "height": 20},
            "font": {"size": 10, "line_height": 1},
            "runs": [{"text": "Short text"}],
            "decorative": False,
            "name": "body",
            "min_length": 5,
            "max_length": 10,
        }
    ]
    plan = generation.TextCapacityPlan.model_validate(
        {
            "adjustments": [
                {
                    "path": "elements.0",
                    "left_characters": 0,
                    "right_characters": 10,
                    "top_lines": 0,
                    "bottom_lines": 0,
                    "horizontal_alignment": "preserve",
                    "vertical_alignment": "preserve",
                }
            ]
        }
    )

    generation._apply_text_capacity_plan(elements, plan)

    text = elements[0]
    assert text["position"] == {"x": 100.0, "y": 100.0}
    assert text["size"]["width"] > 100
    assert text["size"]["height"] == 20
    assert text["max_length"] > 10
    assert text["min_length"] == (text["max_length"] + 1) // 2


def test_generate_slide_layout_runs_focused_passes(monkeypatch):
    raw_layout = _raw_layout()
    manifest = _manifest()
    flexible_plan = _flexible_plan()
    calls = []

    def fake_generate(*, output_model, max_tokens, **_kwargs):
        calls.append((output_model, max_tokens))
        if output_model is generation.VisualDataReplacementPlan:
            return {"replacements": []}
        if output_model is generation.SemanticSlideManifest:
            return manifest.model_dump(mode="json")
        if output_model is generation.FlexibleSlidePlan:
            return flexible_plan.model_dump(mode="json")
        if output_model is generation.TextCapacityPlan:
            return {"adjustments": []}
        raise AssertionError(f"unexpected output model: {output_model}")

    monkeypatch.setattr(
        generation,
        "_generate_structured_with_provider_fallback",
        fake_generate,
    )

    layout = generate_slide_layout(
        raw_layout,
        0,
        "https://example.com/slide.png",
        {"Inter": "https://example.com/inter.woff2"},
        max_tokens=12000,
    )

    assert [output_model for output_model, _ in calls] == [
        generation.VisualDataReplacementPlan,
        generation.SemanticSlideManifest,
        generation.FlexibleSlidePlan,
        generation.TextCapacityPlan,
    ]
    assert [max_tokens for _, max_tokens in calls] == [12000] * 4
    assert layout.components[1].elements[0].type == "grid"


def test_text_capacity_failure_preserves_flexible_layout(monkeypatch):
    manifest = _manifest()
    flexible_plan = _flexible_plan()

    def fake_generate(*, output_model, **_kwargs):
        if output_model is generation.VisualDataReplacementPlan:
            return {"replacements": []}
        if output_model is generation.SemanticSlideManifest:
            return manifest.model_dump(mode="json")
        if output_model is generation.FlexibleSlidePlan:
            return flexible_plan.model_dump(mode="json")
        raise ValueError("text capacity provider unavailable")

    monkeypatch.setattr(
        generation,
        "_generate_structured_with_provider_fallback",
        fake_generate,
    )

    layout = generate_slide_layout(
        _raw_layout(),
        0,
        "https://example.com/slide.png",
    )

    assert layout.components[1].elements[0].type == "grid"


def test_text_capacity_pass_supports_justified_alignment():
    raw_layout = generation.RawSlideLayout.model_validate(
        {
            "id": "body_copy",
            "description": "A reusable body copy region with justified text.",
            "elements": [
                {
                    "type": "text",
                    "position": {"x": 120, "y": 160},
                    "size": {"width": 720, "height": 240},
                    "alignment": {"horizontal": "left", "vertical": "top"},
                    "runs": [{"text": "Reference paragraph text"}],
                    "decorative": True,
                    "name": "body",
                    "min_length": 20,
                    "max_length": 120,
                }
            ],
        }
    )
    manifest = generation.SemanticSlideManifest.model_validate(
        {
            "id": "justified_body_copy",
            "description": "One reusable body copy region with justified paragraph text.",
            "components": [
                {
                    "id": "body_copy",
                    "description": "A single reusable paragraph text region.",
                    "element_indices": [0],
                    "repeated_items": None,
                }
            ],
            "annotations": [
                {
                    "path": "elements.0",
                    "name": "body",
                    "decorative": False,
                }
            ],
        }
    )
    capacity_plan = generation.TextCapacityPlan.model_validate(
        {
            "adjustments": [
                {
                    "path": "elements.0",
                    "left_characters": 0,
                    "right_characters": 0,
                    "top_lines": 0,
                    "bottom_lines": 0,
                    "horizontal_alignment": "justify",
                    "vertical_alignment": "preserve",
                }
            ]
        }
    )

    layout = generation._compile_semantic_layout(
        raw_layout,
        manifest,
        generation.FlexibleSlidePlan(regions=[]),
        capacity_plan,
    )

    text = layout.components[0].elements[0]
    assert text.alignment.horizontal.value == "justify"
    assert text.alignment.vertical.value == "top"


def test_text_capacity_validation_ignores_unsupported_growth():
    source_elements = _raw_layout().model_dump(mode="json")["elements"]
    plan = generation.TextCapacityPlan.model_validate(
        {
            "adjustments": [
                {
                    "path": "elements.1.children.0",
                    "left_characters": 0,
                    "right_characters": 1,
                    "top_lines": 0,
                    "bottom_lines": 0,
                    "horizontal_alignment": "preserve",
                    "vertical_alignment": "preserve",
                },
                {
                    "path": "elements.2.children.0",
                    "left_characters": 0,
                    "right_characters": 1,
                    "top_lines": 0,
                    "bottom_lines": 0,
                    "horizontal_alignment": "center",
                    "vertical_alignment": "preserve",
                },
            ]
        }
    )

    generation._validate_text_capacity_plan(
        plan,
        manifest=_manifest(),
        flexible_plan=generation.FlexibleSlidePlan(regions=[]),
        source_elements=source_elements,
    )

    assert len(plan.adjustments) == 1
    adjustment = plan.adjustments[0]
    assert adjustment.path == "elements.2.children.0"
    assert adjustment.right_characters == 0
    assert adjustment.horizontal_alignment == "center"


def test_text_capacity_validation_removes_unsupported_repeated_growth_as_group():
    source_elements = _raw_layout().model_dump(mode="json")["elements"]
    constrained_text = source_elements[1]["children"][0]
    constrained_text["position"]["x"] = 0
    constrained_text["size"]["width"] = 200
    for element in source_elements[2:5]:
        element["children"][0]["size"]["width"] = 100

    plan = generation.TextCapacityPlan.model_validate(
        {
            "adjustments": [
                {
                    "path": f"elements.{index}.children.0",
                    "left_characters": 0,
                    "right_characters": 5,
                    "top_lines": 0,
                    "bottom_lines": 0,
                    "horizontal_alignment": "preserve",
                    "vertical_alignment": "preserve",
                }
                for index in range(1, 5)
            ]
        }
    )

    generation._validate_text_capacity_plan(
        plan,
        manifest=_manifest(),
        flexible_plan=_flexible_plan(),
        source_elements=source_elements,
    )

    assert plan.adjustments == []


def test_generation_failure_falls_back_without_rewriting_source(monkeypatch):
    raw_layout = _raw_layout()

    def fail_generation(**_kwargs):
        raise ValueError("semantic generation unavailable")

    monkeypatch.setattr(
        generation,
        "_generate_structured_with_provider_fallback",
        fail_generation,
    )

    layout = generate_slide_layout(
        raw_layout,
        0,
        "https://example.com/slide.png",
    )

    assert len(layout.components) == 1
    assert len(layout.components[0].elements) == len(raw_layout.elements)
    assert layout.components[0].elements[0].type == "vector"
    assert layout.components[0].elements[1].children[0].name == "metric_1"
    assert all(
        element.children[0].decorative is False
        for element in layout.components[0].elements[1:]
    )


def test_structured_generation_honors_requested_validation_retries():
    calls = []

    def fail(*_args):
        calls.append(True)
        raise ValueError("invalid candidate")

    provider = generation.TemplateStructuredProvider(name="test", call=fail)
    with pytest.raises(ValueError, match="invalid candidate"):
        generation._generate_structured_with_provider_fallback(
            messages=[],
            label="retry test",
            output_model=generation.FlexibleSlidePlan,
            response_name="FlexibleSlidePlanResponse",
            validation_retries=2,
            providers=[provider],
        )

    assert len(calls) == 2


def test_unsupported_text_growth_does_not_retry_provider():
    calls = []
    response = {
        "adjustments": [
            {
                "path": "elements.1.children.0",
                "left_characters": 0,
                "right_characters": 1,
                "top_lines": 0,
                "bottom_lines": 0,
                "horizontal_alignment": "preserve",
                "vertical_alignment": "preserve",
            }
        ]
    }

    def return_unsupported_growth(*_args):
        calls.append(True)
        return response

    source_elements = _raw_layout().model_dump(mode="json")["elements"]
    provider = generation.TemplateStructuredProvider(
        name="test",
        call=return_unsupported_growth,
    )
    result = generation._generate_structured_with_provider_fallback(
        messages=[],
        label="slide 1 text capacity",
        output_model=generation.TextCapacityPlan,
        response_name="TextCapacityPlanResponse",
        validation_retries=5,
        providers=[provider],
        extra_validator=lambda plan: generation._validate_text_capacity_plan(
            plan,
            manifest=_manifest(),
            flexible_plan=generation.FlexibleSlidePlan(regions=[]),
            source_elements=source_elements,
        ),
    )

    assert calls == [True]
    assert result == {"adjustments": []}


def test_visual_data_llm_schema_uses_table_envelope_only_for_gemini():
    canonical_schema = generation._llm_output_json_schema(
        generation.VisualDataReplacementPlan
    )
    schema = generation._response_schema_for_model(
        model="models/gemini-3.7-flash",
        response_name="VisualDataReplacementPlanResponse",
        response_schema=canonical_schema,
    )
    replacement_schema = schema["properties"]["replacements"]["items"]

    assert "discriminator" not in replacement_schema
    assert "oneOf" not in replacement_schema
    assert len(replacement_schema["anyOf"]) == 4
    table_schema = next(
        alternative
        for alternative in replacement_schema["anyOf"]
        if alternative.get("properties", {}).get("kind", {}).get("enum") == ["table"]
    )
    assert table_schema["properties"]["kind"]["enum"] == ["table"]
    assert table_schema["required"] == [
        "kind",
        "path",
        "position",
        "size",
        "data_json",
    ]
    assert table_schema["properties"]["position"] == {"$ref": "#/$defs/Position"}
    assert table_schema["properties"]["size"] == {"$ref": "#/$defs/Size"}
    infographic_schema = next(
        alternative
        for alternative in replacement_schema["anyOf"]
        if alternative.get("properties", {}).get("kind", {}).get("enum")
        == ["infographic"]
    )
    assert infographic_schema["required"] == [
        "kind",
        "path",
        "position",
        "size",
        "data_json",
    ]
    assert "VisualInfographicReplacement" not in schema["$defs"]

    runtime_items = canonical_schema["properties"]["replacements"]["items"]
    assert "discriminator" in runtime_items
    assert "oneOf" in runtime_items
    runtime_definition_names = {
        alternative["$ref"].rsplit("/", 1)[-1]
        for alternative in runtime_items["oneOf"]
    }
    assert runtime_definition_names == {
        "VisualChartReplacement",
        "VisualInfographicReplacement",
        "VisualTableReplacement",
        "VisualTextListReplacement",
    }
    infographic_runtime_schema = canonical_schema["$defs"][
        "VisualInfographicReplacement"
    ]
    assert infographic_runtime_schema["properties"]["colors"]["minItems"] == 2
    assert "track_height" not in str(infographic_runtime_schema)

    assert generation._response_schema_for_model(
        model="gpt-5.4",
        response_name="VisualDataReplacementPlanResponse",
        response_schema=canonical_schema,
    ) is canonical_schema


def test_visual_data_table_encoding_prompt_is_only_added_for_gemini():
    messages = [
        generation.SystemMessage(
            content=generation.DETECT_VISUAL_DATA_REGIONS_SYSTEM_PROMPT
        ),
        generation.UserMessage(content="visual candidates"),
    ]

    gemini_messages = generation._messages_for_structured_provider(
        messages=messages,
        model="models/gemini-3.7-flash",
        response_name="VisualDataReplacementPlanResponse",
    )
    gemini_system_prompt = gemini_messages[0].content
    assert isinstance(gemini_system_prompt, str)
    assert "# Gemini complex visual-data response encoding:" in gemini_system_prompt
    assert '`data_json` is a JSON string' in gemini_system_prompt
    assert '"columns": [CELL, ...]' in gemini_system_prompt
    assert '"alignment": null | "left" | "center" | "right" | "justify"' in (
        gemini_system_prompt
    )

    openai_messages = generation._messages_for_structured_provider(
        messages=messages,
        model="gpt-5.4",
        response_name="VisualDataReplacementPlanResponse",
    )
    openai_system_prompt = openai_messages[0].content
    assert isinstance(openai_system_prompt, str)
    assert "data_json" not in openai_system_prompt
    assert "Gemini table response encoding" not in openai_system_prompt


def test_visual_data_table_cells_are_normalized_before_runtime_validation():
    parsed = {
        "replacements": [
            {
                "kind": "table",
                "path": "elements.1",
                "position": {"x": 120, "y": 160},
                "size": {"width": 640, "height": 320},
                "data_json": json.dumps(
                    {
                        "columns": [
                            {
                                "text": "Metric",
                                "color": {"color": "#FFFFFF"},
                                "font": {
                                    "family": "Inter",
                                    "size": 18,
                                    "color": "#111111",
                                    "bold": True,
                                    "italic": False,
                                    "underline": False,
                                },
                                "alignment": "left",
                            }
                        ],
                        "rows": [
                            [
                                {
                                    "text": "Revenue",
                                    "color": None,
                                    "font": None,
                                    "alignment": None,
                                }
                            ]
                        ],
                    }
                ),
            }
        ]
    }

    normalized = generation._validate_output_model(
        parsed,
        generation.VisualDataReplacementPlan,
    )
    header = normalized["replacements"][0]["columns"][0]
    body = normalized["replacements"][0]["rows"][0][0]

    assert header["color"] == {"color": "#FFFFFF", "opacity": None}
    assert header["font"]["family"] == "Inter"
    assert header["font"]["size"] == 18
    assert body["color"] is None
    assert body["font"] is None


def test_flexible_llm_schema_exposes_exclusive_flow_item_variants():
    schema = generation._llm_output_json_schema(generation.FlexibleSlidePlan)
    item_schema = schema["$defs"]["FlexibleFlowItemPlan"]
    flow_schema = schema["$defs"]["FlexibleFlowNodePlan"]

    assert item_schema["required"] == ["indices", "flow_id"]
    assert len(item_schema["anyOf"]) == 2
    assert item_schema["anyOf"][0]["properties"]["indices"]["minItems"] == 1
    assert item_schema["anyOf"][0]["properties"]["flow_id"] == {"type": "null"}
    assert item_schema["anyOf"][1]["properties"]["indices"] == {"type": "null"}
    assert flow_schema["properties"]["items"]["minItems"] == 2


def test_flexible_retry_prompt_repeats_tree_correction_contract():
    retry_messages = generation._messages_for_structured_retry(
        messages=[],
        label="slide 1 flexible regions",
        output_model=generation.FlexibleSlidePlan,
        error=ValueError("fixed flow items do not form an aligned row or column"),
        invalid_response={"regions": []},
    )

    prompt = retry_messages[-1].content
    assert "task_specific_correction_rules:" in prompt
    assert "at least two items" in prompt
    assert "collapse unary helper flows" in prompt
    assert "partition the component element_indices exactly once" in prompt
    assert "remove orphan and shared flows" in prompt
    assert "omit the region instead of guessing" in prompt


def test_text_capacity_llm_schema_requires_complete_flat_adjustments():
    schema = generation._llm_output_json_schema(generation.TextCapacityPlan)
    adjustment_schema = schema["$defs"]["TextCapacityAdjustment"]

    assert "anyOf" not in adjustment_schema
    assert adjustment_schema["required"] == [
        "path",
        "left_characters",
        "right_characters",
        "top_lines",
        "bottom_lines",
        "horizontal_alignment",
        "vertical_alignment",
    ]


def test_text_capacity_retry_prompt_forbids_no_op_adjustments():
    invalid_response = {
        "adjustments": [
            {
                "path": "elements.1",
                "left_characters": 0,
                "right_characters": 0,
                "top_lines": 0,
                "bottom_lines": 0,
                "horizontal_alignment": "preserve",
                "vertical_alignment": "preserve",
            }
        ]
    }
    with pytest.raises(ValueError) as exc_info:
        generation.TextCapacityPlan.model_validate(invalid_response)

    retry_messages = generation._messages_for_structured_retry(
        messages=[],
        label="slide 1 text capacity",
        output_model=generation.TextCapacityPlan,
        error=exc_info.value,
        invalid_response=invalid_response,
    )

    prompt = retry_messages[-1].content
    assert "Task-specific correction rules:" in prompt
    assert "one complete object" in prompt
    assert "never split fields across array entries" in prompt
    assert "Omit every no-op adjustment" in prompt
    assert "Return an empty adjustments list" in prompt


def test_repeat_signature_allows_leading_divider_on_upcoming_items():
    source_elements = [
        {
            "type": "text",
            "position": {"x": 0, "y": 0},
            "size": {"width": 80, "height": 30},
            "runs": [{"text": "42%"}],
            "decorative": False,
            "name": "metric_value_1",
        },
        {
            "type": "vector",
            "points": [{"x": 100, "y": 0}, {"x": 100, "y": 60}],
            "closed": False,
            "stroke": {"color": "#000000", "width": 1},
            "decorative": True,
        },
        {
            "type": "text",
            "position": {"x": 120, "y": 0},
            "size": {"width": 80, "height": 30},
            "runs": [{"text": "74K"}],
            "decorative": False,
            "name": "metric_value_2",
        },
    ]

    assert generation._region_items_are_structurally_equivalent(
        [[0], [1, 2]],
        source_elements,
    )


def test_layout_compilation_reserves_single_line_text_overflow_space():
    raw_layout = generation.RawSlideLayout.model_validate(
        {
            "id": "metric_card",
            "description": "A compact metric card with a one-line editable value.",
            "elements": [
                {
                    "type": "group",
                    "name": "source_metric_card",
                    "position": {"x": 40, "y": 100},
                    "size": {"width": 222.64, "height": 121.37},
                    "children": [
                        {
                            "type": "container",
                            "position": {"x": 0, "y": 0},
                            "size": {"width": 222.64, "height": 121.37},
                            "fill": {"color": "#FFFFFF"},
                            "decorative": True,
                        },
                        {
                            "type": "text",
                            "position": {"x": 18.93, "y": 33.05},
                            "size": {"width": 142.63, "height": 38.8},
                            "font": {"size": 38.04, "line_height": 0.98},
                            "runs": [{"text": "2.40M"}],
                            "decorative": True,
                            "name": "source_metric",
                            "min_length": 2,
                            "max_length": 5,
                        },
                    ],
                }
            ],
        }
    )
    manifest = generation.SemanticSlideManifest.model_validate(
        {
            "id": "metric_card",
            "description": "A compact metric card with a one-line editable value.",
            "components": [
                {
                    "id": "metric_card",
                    "description": "A card containing one prominent metric value.",
                    "element_indices": [0],
                    "repeated_items": None,
                }
            ],
            "annotations": [
                {
                    "path": "elements.0.children.1",
                    "name": "metric_value",
                    "decorative": False,
                }
            ],
        }
    )

    layout = generation._compile_semantic_layout(
        raw_layout,
        manifest,
        generation.FlexibleSlidePlan(regions=[]),
        generation.TextCapacityPlan(adjustments=[]),
    )
    metric = layout.components[0].elements[0].children[1]

    assert metric.size.width == pytest.approx(
        142.63 / generation.TEXT_CAPACITY_SAFETY_FACTOR,
        abs=0.01,
    )
    assert metric.max_length == 5


def test_visual_data_plan_rejects_bounds_outside_candidate():
    raw_layout = generation.RawSlideLayout.model_validate(
        {
            "id": "padded_table_image",
            "description": "A table inside a larger padded source image.",
            "elements": [
                {
                    "type": "image",
                    "position": {"x": 100, "y": 120},
                    "size": {"width": 400, "height": 240},
                    "data": "https://example.com/list.png",
                    "decorative": True,
                    "name": "table_image",
                    "is_icon": False,
                }
            ],
        }
    )
    plan = generation.VisualDataReplacementPlan.model_validate(
        {
            "replacements": [
                {
                    "kind": "table",
                    "path": "elements.0",
                    "position": {"x": 90, "y": 140},
                    "size": {"width": 300, "height": 180},
                    "columns": [
                        {
                            "text": "Heading",
                            "color": None,
                            "font": None,
                            "alignment": None,
                        }
                    ],
                    "rows": [],
                }
            ]
        }
    )
    _, candidate_paths = generation._visual_data_generation_payload(raw_layout)

    with pytest.raises(ValueError, match="bounds must stay inside candidate"):
        generation._validate_visual_data_replacement_plan(
            plan,
            candidate_paths=candidate_paths,
            source_elements=raw_layout.model_dump(mode="json")["elements"],
        )


def test_visual_data_plan_rejects_marker_gap_for_unmarked_text_list():
    with pytest.raises(ValueError, match="unmarked text list must have marker_gap=0"):
        generation.VisualDataReplacementPlan.model_validate(
            {
                "replacements": [
                    {
                        "kind": "text-list",
                        "path": "elements.0",
                        "marker": "none",
                        "font": None,
                        "gap": 12,
                        "marker_gap": 6,
                        "items": ["First", "Second"],
                    }
                ]
            }
        )


@pytest.mark.parametrize("kind", ["progress_bar", "gauge"])
def test_visual_data_pass_converts_group_to_infographic(kind):
    raw_layout = generation.RawSlideLayout.model_validate(
        {
            "id": f"{kind}_group",
            "description": "A grouped shape-based quantitative status indicator.",
            "elements": [
                {
                    "type": "group",
                    "position": {"x": 200, "y": 220},
                    "size": {"width": 360, "height": 140},
                    "name": "status_visual",
                    "children": [
                        {
                            "type": "vector",
                            "points": [
                                {"x": 0, "y": 0},
                                {"x": 300, "y": 0},
                                {"x": 300, "y": 24},
                                {"x": 0, "y": 24},
                            ],
                            "closed": True,
                            "fill": {"color": "#2563EB"},
                        }
                    ],
                }
            ],
        }
    )
    plan = generation.VisualDataReplacementPlan.model_validate(
        {
            "replacements": [
                {
                    "kind": "infographic",
                    "path": "elements.0",
                    "position": {"x": 200, "y": 220},
                    "size": {"width": 360, "height": 140},
                    "data": {
                        "type": kind,
                        "min_value": 0,
                        "max_value": 100,
                        "value": 64,
                    },
                    "colors": ["#E5E7EB", "#2563EB"],
                    "text_color": None,
                }
            ]
        }
    )

    _, candidate_paths = generation._visual_data_generation_payload(raw_layout)
    generation._validate_visual_data_replacement_plan(
        plan,
        candidate_paths=candidate_paths,
        source_elements=raw_layout.model_dump(mode="json")["elements"],
    )
    converted = generation._apply_visual_data_replacement_plan(raw_layout, plan)

    infographic = converted.elements[0]
    assert infographic.type == "infographic"
    assert infographic.data.type == kind
    assert infographic.data.value == 64
    assert infographic.colors == ["#E5E7EB", "#2563EB"]
    assert infographic.text_color is None


@pytest.mark.parametrize("kind", ["progress_bar", "gauge"])
def test_visual_data_plan_rejects_text_color_for_metric_infographic(kind):
    with pytest.raises(ValueError, match="text_color must be null"):
        generation.VisualDataReplacementPlan.model_validate(
            {
                "replacements": [
                    {
                        "kind": "infographic",
                        "path": "elements.0",
                        "position": {"x": 200, "y": 220},
                        "size": {"width": 360, "height": 140},
                        "data": {
                            "type": kind,
                            "min_value": 0,
                            "max_value": 100,
                            "value": 64,
                        },
                        "colors": ["#E5E7EB", "#2563EB"],
                        "text_color": "#111827",
                    }
                ]
            }
        )
