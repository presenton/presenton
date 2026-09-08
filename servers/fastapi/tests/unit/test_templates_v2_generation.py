import json
import logging
from types import SimpleNamespace

import pytest
from llmai.shared import (
    AssistantMessage,
    AssistantToolCall,
    ImageContentPart,
    SystemMessage,
    UserMessage,
)
from pydantic import BaseModel, Field, ValidationError

from templates.v2.certified_generation import (
    CLUSTER_SIMILAR_COMPONENTS_SYSTEM_PROMPT,
    GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT,
)
from templates.v2.generation import (
    _generate_preview_candidate,
    _messages_for_json_repair_retry,
    _messages_for_model_validation_retry,
    _slide_image_content,
    _validate_similarity_groups,
    generate_template,
    merge_similar_components,
)
from templates.v2.models.elements import Image as TemplateImage
from templates.v2.models.layouts import (
    RawSlideLayout,
    RawSlideLayouts,
    SimilarComponents,
    SimilarComponentsList,
    SlideLayout,
    SlideLayouts,
    slide_layout_llm_json_schema,
)
from templates.v2.tools import PreviewSlideTool


class _FakeResponse:
    def __init__(self, content, messages=None, tool_calls=None):
        self.content = content
        self.messages = messages or []
        self.tool_calls = tool_calls or []


class _FakeClient:
    def __init__(self, content=None, responses=None):
        self.content = content
        self.responses = list(responses or [])
        self.calls = []

    def generate(self, **kwargs):
        self.calls.append(kwargs)
        if self.responses:
            return self.responses.pop(0)
        return _FakeResponse(self.content)


class _ProviderResponseItem:
    id = "rs_00000000000000000000000000000000"


class _RetrySchema(BaseModel):
    title: str = Field(min_length=5)


def _raw_layout(layout_id: str = "source_slide") -> RawSlideLayout:
    return RawSlideLayout.model_validate(
        {
            "id": layout_id,
            "description": "Source slide with a title block.",
            "elements": [
                {
                    "type": "text",
                    "position": {"x": 100, "y": 80},
                    "size": {"width": 600, "height": 80},
                    "decorative": False,
                    "name": "title",
                    "min_length": 20,
                    "max_length": 40,
                    "runs": [{"text": "Original title"}],
                }
            ],
        }
    )


def _generated_layout(layout_id: str = "title_slide") -> dict:
    return {
        "id": layout_id,
        "description": "Reusable slide with a prominent title block.",
        "components": [
            {
                "id": "title_block",
                "description": "Reusable prominent title text block.",
                "position": {"x": 100, "y": 80},
                "elements": [
                    {
                        "type": "text",
                        "position": {"x": 0, "y": 0},
                        "size": {"width": 600, "height": 80},
                        "decorative": False,
                        "name": "title",
                        "min_length": 20,
                        "max_length": 40,
                        "runs": [{"text": "Original title"}],
                    }
                ],
            }
        ],
    }


def test_template_image_supports_optional_overlay_color():
    image = TemplateImage.model_validate(
        {
            "type": "image",
            "data": "/app_data/image.png",
            "color": "rgba(0, 0, 0, 0.35)",
            "decorative": True,
            "name": "background",
            "is_icon": False,
        }
    )
    image_without_overlay = TemplateImage.model_validate(
        {
            "type": "image",
            "data": "/app_data/image.png",
            "decorative": True,
            "name": "background",
            "is_icon": False,
        }
    )

    assert image.color == "rgba(0, 0, 0, 0.35)"
    assert image_without_overlay.color is None


def test_generate_preview_candidate_returns_last_preview_tool_json(monkeypatch, caplog):
    preview_tool_call = AssistantToolCall(
        id="preview-call-1",
        name="previewSlide",
        arguments=json.dumps(_generated_layout()),
    )
    client = _FakeClient(
        responses=[_FakeResponse(None, tool_calls=[preview_tool_call])]
    )
    render_calls = []

    def fake_render(_self, layout):
        render_calls.append(layout.id)
        return ImageContentPart(
            data=b"rendered-preview",
            mime_type="image/png",
        )

    monkeypatch.setattr(PreviewSlideTool, "render", fake_render)
    caplog.set_level(logging.INFO, logger="templates.v2.generation")

    result = _generate_preview_candidate(
        client=client,
        model="test-model",
        messages=[
            SystemMessage(content=GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT),
            UserMessage(content="{}"),
        ],
        label="slide layout",
        preview_tool=PreviewSlideTool(),
        validation_retries=0,
    )

    assert result == SlideLayout.model_validate(_generated_layout())
    assert render_calls == ["title_slide"]
    assert len(client.calls) == 1
    call = client.calls[0]
    assert (
        call["response_format"].json_schema
        == slide_layout_llm_json_schema()
    )
    assert "max_tokens" not in call
    messages = [record.getMessage() for record in caplog.records]
    assert any(
        "slide layout: preview slide rendered" in message
        for message in messages
    )
    assert any(
        "slide layout: returning preview slide JSON as final" in message
        for message in messages
    )


def test_generate_preview_candidate_preserves_provider_response_messages(monkeypatch):
    preview_tool_call = AssistantToolCall(
        id="preview-call-1",
        name="previewSlide",
        arguments=json.dumps(_generated_layout("first_candidate")),
    )
    preserved_assistant_message = AssistantMessage(
        content=["provider-preserved-context"],
        tool_calls=[preview_tool_call],
    )
    initial_messages = [
        SystemMessage(content=GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT),
        UserMessage(content="{}"),
    ]
    client = _FakeClient(
        responses=[
            _FakeResponse(
                None,
                messages=[*initial_messages, preserved_assistant_message],
                tool_calls=[preview_tool_call],
            ),
            _FakeResponse(_generated_layout("final_candidate")),
        ]
    )

    monkeypatch.setattr(
        PreviewSlideTool,
        "render",
        lambda _self, _layout: ImageContentPart(
            data=b"rendered-preview",
            mime_type="image/png",
        ),
    )

    result = _generate_preview_candidate(
        client=client,
        model="test-model",
        messages=initial_messages,
        label="slide layout",
        preview_tool=PreviewSlideTool(),
        validation_retries=1,
    )

    assert result == SlideLayout.model_validate(_generated_layout("final_candidate"))
    follow_up_messages = client.calls[1]["messages"]
    assert follow_up_messages[2] is preserved_assistant_message
    assert follow_up_messages[3].id == "preview-call-1"
    assert follow_up_messages[4].content[0].data == b"rendered-preview"
    assert "Original slide image:" not in follow_up_messages[4].content


def test_generate_template_generates_each_slide_and_preserves_order(monkeypatch):
    raw_layouts = RawSlideLayouts(
        layouts=[_raw_layout("first"), _raw_layout("second")]
    )
    calls = []

    def fake_generate(source_layout, slide_index, slide_image_url, fonts=None):
        calls.append((source_layout.id, slide_index, slide_image_url, fonts))
        return SlideLayout.model_validate(
            _generated_layout(f"generated_{source_layout.id}")
        )

    monkeypatch.setattr(
        "templates.v2.generation.generate_slide_layout", fake_generate
    )

    generated = generate_template(
        raw_layouts,
        ["https://example.com/first.png", "https://example.com/second.png"],
        {"Inter": "https://example.com/inter.css"},
    )

    assert sorted(calls) == [
        (
            "first",
            0,
            "https://example.com/first.png",
            {"Inter": "https://example.com/inter.css"},
        ),
        (
            "second",
            1,
            "https://example.com/second.png",
            {"Inter": "https://example.com/inter.css"},
        ),
    ]
    assert [layout.id for layout in generated.layouts] == [
        "generated_first",
        "generated_second",
    ]


def test_generate_template_repairs_duplicate_generated_layout_ids(monkeypatch):
    raw_layouts = RawSlideLayouts(
        layouts=[_raw_layout("first"), _raw_layout("second")]
    )

    def fake_generate(source_layout, slide_index, slide_image_url, fonts=None):
        return SlideLayout.model_validate(_generated_layout("duplicate_layout"))

    monkeypatch.setattr(
        "templates.v2.generation.generate_slide_layout", fake_generate
    )

    generated = generate_template(
        raw_layouts,
        ["https://example.com/first.png", "https://example.com/second.png"],
    )

    assert [layout.id for layout in generated.layouts] == [
        "duplicate_layout",
        "duplicate_layout_2",
    ]


def test_generate_template_rejects_empty_source():
    with pytest.raises(ValueError, match="at least one"):
        generate_template(RawSlideLayouts(layouts=[]), [])


def test_generate_template_requires_one_image_per_layout():
    with pytest.raises(ValueError, match="one image for each layout"):
        generate_template(
            RawSlideLayouts(layouts=[_raw_layout("first"), _raw_layout("second")]),
            ["https://example.com/first.png"],
        )


def test_merge_similar_components_clusters_by_global_component_index(
    monkeypatch, caplog
):
    first = _generated_layout("first_layout")
    first["components"][0]["id"] = "title_block"
    first["components"][0]["description"] = (
        "Reusable prominent title text block for opening slides."
    )
    second = _generated_layout("second_layout")
    second["components"][0]["id"] = "metric_grid"
    second["components"][0]["description"] = (
        "Reusable grid presenting several business metrics and labels."
    )
    second["components"][0]["elements"] = [
        {
            "type": "grid",
            "position": {"x": 0, "y": 0},
            "size": {"width": 600, "height": 180},
            "columns": 2,
            "rows": 1,
            "gap": 24,
            "name": "metrics",
            "min_children": 1,
            "max_children": 2,
            "children": [
                {
                    "type": "text",
                    "size": {"width": 280, "height": 80},
                    "decorative": False,
                    "name": "metric_value",
                    "min_length": 1,
                    "max_length": 10,
                    "runs": [{"text": "42%"}],
                },
                {
                    "type": "text",
                    "size": {"width": 280, "height": 80},
                    "decorative": False,
                    "name": "metric_label",
                    "min_length": 5,
                    "max_length": 30,
                    "runs": [{"text": "Revenue growth"}],
                },
            ],
        }
    ]
    third = _generated_layout("third_layout")
    third["components"][0]["id"] = "section_heading"
    third["components"][0]["description"] = (
        "Reusable prominent heading text block for section slides."
    )
    layouts = SlideLayouts.model_validate({"layouts": [first, second, third]})
    client = _FakeClient(
        {
            "similar_components": [
                {"indices": [0, 2]},
            ]
        }
    )
    monkeypatch.setattr("templates.v2.generation.get_client", lambda **_kwargs: client)
    monkeypatch.setattr("templates.v2.generation.get_llm_config", lambda: {})
    monkeypatch.setattr("templates.v2.generation.get_model", lambda: "test-model")
    caplog.set_level(logging.INFO, logger="templates.v2.certified_generation")

    merged = merge_similar_components(layouts)

    assert len(merged.components) == 2
    assert merged.components[0].id == "title_block"
    assert [variant.id for variant in merged.components[0].variants] == [
        "title_block",
        "section_heading",
    ]
    assert [variant.id for variant in merged.components[1].variants] == [
        "metric_grid"
    ]

    call = client.calls[0]
    assert call["response_format"].json_schema["title"] == "SimilarComponentsList"
    assert call["response_format"].name == "SimilarComponentsResponse"
    assert call["messages"][0].content == CLUSTER_SIMILAR_COMPONENTS_SYSTEM_PROMPT
    payload = json.loads(call["messages"][1].content)
    assert [component["index"] for component in payload["components"]] == [0, 1, 2]
    assert [component["id"] for component in payload["components"]] == [
        "title_block",
        "metric_grid",
        "section_heading",
    ]
    assert all("editable_schema" in component for component in payload["components"])
    assert all("position" in component for component in payload["components"])
    assert all("content_bounds" in component for component in payload["components"])
    assert all("element_hierarchy" in component for component in payload["components"])
    messages = "\n".join(record.getMessage() for record in caplog.records)
    assert "similar_components" not in messages
    assert "schema=SimilarComponentsResponse" in messages


def test_merge_similar_components_skips_llm_for_single_component(monkeypatch):
    monkeypatch.setattr(
        "templates.v2.generation.get_client",
        lambda **_kwargs: pytest.fail("LLM should not be called"),
    )
    layouts = SlideLayouts.model_validate({"layouts": [_generated_layout()]})

    merged = merge_similar_components(layouts)

    assert len(merged.components) == 1
    assert merged.components[0].id == "title_block"
    assert len(merged.components[0].variants) == 1


def test_merge_similar_components_removes_structural_duplicates_after_clustering(
    monkeypatch,
):
    first = _generated_layout("first_layout")
    first["components"][0]["id"] = "headline_a"
    first["components"][0]["description"] = (
        "Reusable headline card with static divider decoration."
    )
    first["components"][0]["elements"] = [
        {
            "type": "vector",
            "points": [
                {"x": 0, "y": 70},
                {"x": 600, "y": 70},
                {"x": 600, "y": 74},
                {"x": 0, "y": 74},
            ],
            "closed": True,
            "fill": {"color": "#111111"},
        },
        {
            "type": "text",
            "position": {"x": 0, "y": 0},
            "size": {"width": 600, "height": 60},
            "decorative": False,
            "name": "headline",
            "min_length": 5,
            "max_length": 60,
            "runs": [{"text": "First headline content"}],
        },
    ]
    second = _generated_layout("second_layout")
    second["components"][0]["id"] = "headline_b"
    second["components"][0]["description"] = (
        "Reusable title card with the same static divider decoration."
    )
    second["components"][0]["position"] = {"x": 260, "y": 180}
    second["components"][0]["elements"] = [
        {
            "type": "vector",
            "points": [
                {"x": 0, "y": 70},
                {"x": 600, "y": 70},
                {"x": 600, "y": 74},
                {"x": 0, "y": 74},
            ],
            "closed": True,
            "fill": {"color": "#111111"},
        },
        {
            "type": "text",
            "position": {"x": 0, "y": 0},
            "size": {"width": 600, "height": 60},
            "decorative": False,
            "name": "title",
            "min_length": 5,
            "max_length": 80,
            "runs": [{"text": "Different editable title copy"}],
        },
    ]
    third = _generated_layout("third_layout")
    third["components"][0]["id"] = "headline_c"
    third["components"][0]["description"] = (
        "Reusable headline card with a different static divider decoration."
    )
    third["components"][0]["elements"] = [
        {
            "type": "vector",
            "points": [
                {"x": 0, "y": 70},
                {"x": 600, "y": 70},
                {"x": 600, "y": 74},
                {"x": 0, "y": 74},
            ],
            "closed": True,
            "fill": {"color": "#DDDDDD"},
        },
        {
            "type": "text",
            "position": {"x": 0, "y": 0},
            "size": {"width": 600, "height": 60},
            "decorative": False,
            "name": "headline",
            "min_length": 5,
            "max_length": 60,
            "runs": [{"text": "Third headline content"}],
        },
    ]
    layouts = SlideLayouts.model_validate({"layouts": [first, second, third]})
    client = _FakeClient({"similar_components": []})
    monkeypatch.setattr("templates.v2.generation.get_client", lambda **_kwargs: client)
    monkeypatch.setattr("templates.v2.generation.get_llm_config", lambda: {})
    monkeypatch.setattr("templates.v2.generation.get_model", lambda: "test-model")

    merged = merge_similar_components(layouts)

    assert len(client.calls) == 1
    assert len(merged.components) == 2
    assert [variant.id for variant in merged.components[0].variants] == [
        "headline_a",
        "headline_b",
    ]
    assert [variant.id for variant in merged.components[1].variants] == [
        "headline_c",
    ]


def test_similar_components_requires_unique_non_negative_indices():
    with pytest.raises(ValidationError, match="must be unique"):
        SimilarComponents(indices=[1, 1])
    with pytest.raises(ValidationError, match="non-negative"):
        SimilarComponents(indices=[-1, 1])


def test_similarity_groups_reject_overlapping_and_out_of_range_indices():
    overlapping = SimilarComponentsList.model_validate(
        {
            "similar_components": [
                {"indices": [0, 1]},
                {"indices": [1, 2]},
            ]
        }
    )
    with pytest.raises(ValueError, match="more than one"):
        _validate_similarity_groups(overlapping, component_count=3)

    out_of_range = SimilarComponentsList.model_validate(
        {"similar_components": [{"indices": [0, 3]}]}
    )
    with pytest.raises(ValueError, match="outside the available range"):
        _validate_similarity_groups(out_of_range, component_count=3)


def test_slide_image_content_embeds_local_image_bytes(tmp_path, monkeypatch):
    image_path = tmp_path / "slide.png"
    image_path.write_bytes(b"png-image-bytes")
    monkeypatch.setattr(
        "templates.v2.generation.resolve_image_path_to_filesystem",
        lambda _url: str(image_path),
    )

    image_content = _slide_image_content("/app_data/images/slide.png")

    assert image_content.data == b"png-image-bytes"
    assert image_content.mime_type == "image/png"
    assert image_content.url is None


def test_preview_slide_tool_renders_layout_components(tmp_path, monkeypatch):
    app_data_dir = tmp_path / "app-data"
    preview_path = tmp_path / "preview.png"
    preview_path.write_bytes(b"rendered-slide")
    captured = {}

    async def fake_render_json_to_image(data, width, height, fonts=None):
        captured["data"] = data
        captured["width"] = width
        captured["height"] = height
        captured["fonts"] = fonts
        return SimpleNamespace(path=str(preview_path))

    monkeypatch.setattr(
        "templates.v2.tools.EXPORT_TASK_SERVICE.render_json_to_image",
        fake_render_json_to_image,
    )
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(app_data_dir))

    image = PreviewSlideTool(
        slide_index=2,
        fonts={"Inter": "https://example.com/inter.css"},
    ).render(
        SlideLayout.model_validate(_generated_layout())
    )

    saved_json_path = app_data_dir / "preview_slide" / "2" / "1.json"
    saved_image_path = app_data_dir / "preview_slide" / "2" / "1.png"

    assert captured["data"][0]["id"] == "title_block"
    assert captured["data"][0]["elements"][0]["type"] == "text"
    assert captured["width"] == 1280
    assert captured["height"] == 720
    assert captured["fonts"] == {"Inter": "https://example.com/inter.css"}
    assert image.data == b"rendered-slide"
    assert image.mime_type == "image/png"
    assert json.loads(saved_json_path.read_text()) == _generated_layout()
    assert saved_image_path.read_bytes() == b"rendered-slide"


def test_slide_layout_rejects_duplicate_component_ids():
    layout = _generated_layout()
    layout["components"].append(layout["components"][0])

    with pytest.raises(ValidationError, match="component ids must be unique"):
        SlideLayout.model_validate(layout)


def test_slide_layout_does_not_accept_fixed_component_metadata():
    layout = _generated_layout()
    element = layout["components"][0]["elements"][0]
    element["fixed"] = element.pop("decorative")

    with pytest.raises(ValidationError):
        SlideLayout.model_validate(layout)


def test_semantic_generation_prompt_uses_reference_only_metadata():
    assert "return semantic metadata for its existing source elements" in (
        GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    )
    assert "Assign every source index once" in GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    assert "decorative=true" in GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    assert "decorative=false" in GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    assert "fixed visual scaffolding" in GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    assert "connector and branching lines" in GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    assert "Component ids must be unique" in GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    assert "a ring around a replaceable topic icon is decorative" in (
        GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    )


def test_certified_generation_prompts_split_flexible_and_visual_decisions():
    from templates.v2 import certified_generation

    flexible_prompt = certified_generation.GENERATE_FLEXIBLE_REGIONS_SYSTEM_PROMPT
    visual_prompt = certified_generation.DETECT_VISUAL_DATA_REGIONS_SYSTEM_PROMPT
    capacity_prompt = certified_generation.GENERATE_TEXT_CAPACITY_SYSTEM_PROMPT

    assert "repeatable regions" in flexible_prompt
    assert "one source index per leaf" in flexible_prompt
    assert "Every flow needs at least two items" in flexible_prompt
    assert "Collapse one-child helper flows" in flexible_prompt
    assert "cover component element_indices exactly once" in flexible_prompt
    assert "Treat group as a fallback only after" in flexible_prompt
    assert "Never use group merely because items are semantically related" in flexible_prompt
    assert "If homogeneous direct items share one row or column rule" in flexible_prompt
    assert "wrapper mode collectively across all sibling items" in flexible_prompt
    assert "child subflows swap order, mirror sides, or use different offsets" in (
        flexible_prompt
    )
    assert "copy column beside a card or visual cluster" in flexible_prompt
    assert "complete item group preserve the fixed relation" in flexible_prompt
    assert "an aligned subsection" in flexible_prompt
    assert "vertically aligned title and description in a column flow" in flexible_prompt
    assert "use group only when none fits" in flexible_prompt
    assert "chart, infographic, table, or text list" in visual_prompt
    assert "Use kind=infographic for either a complete infographic image" in visual_prompt
    assert "data.type=progress_bar or data.type=gauge" in visual_prompt
    assert "metric renderers draw no text" in visual_prompt
    assert "center value-label color" not in visual_prompt
    assert "Atomicity is mandatory" in visual_prompt
    assert "one table or chart becomes exactly one typed replacement" in visual_prompt
    assert "Never emit table cells, rows, headers, borders" in visual_prompt
    assert "Never emit or leave any chart internal" in visual_prompt
    assert "geometrically enclosed sibling elements" in visual_prompt
    assert "preserve clear padding on all four sides" in visual_prompt
    assert "derive each value from filled length" in visual_prompt
    assert "structured table as one atomic editable element" in (
        certified_generation.GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    )
    assert "structured chart as one atomic editable element" in (
        certified_generation.GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    )
    assert "capacity growth" in capacity_prompt.lower()
    assert "Omit a full no-op" in capacity_prompt
    assert "left-aligned slide or section title" in capacity_prompt
    assert "Items entirely below its span do not block" in capacity_prompt
    assert "callout description should normally get positive bottom_lines" in (
        capacity_prompt
    )
    assert "intersection of safe directions" in capacity_prompt
    assert "smallest shared positive bottom_lines value" in capacity_prompt
    assert "previewSlide" not in flexible_prompt


def test_component_clustering_prompt_uses_structure_instead_of_example_content():
    prompt = CLUSTER_SIMILAR_COMPONENTS_SYSTEM_PROMPT

    assert "same structural role" in prompt
    assert "Ignore example content" in prompt
    assert "repeated-item arrangement" in prompt


def test_json_repair_retry_rebuilds_messages_without_provider_response_items():
    original_messages = [
        SystemMessage(content="Return JSON."),
        UserMessage(content="{}"),
    ]
    provider_response_item = _ProviderResponseItem()
    response = _FakeResponse(
        content='{"bad": true',
        messages=[provider_response_item],
    )

    retry_messages = _messages_for_json_repair_retry(
        messages=original_messages,
        response=response,
        label="slide layout",
        error=ValueError("invalid JSON"),
    )

    assert provider_response_item not in retry_messages
    assert retry_messages[:2] == original_messages
    assert isinstance(retry_messages[2], AssistantMessage)
    assert retry_messages[2].content == ['"{\\"bad\\": true"']
    assert isinstance(retry_messages[3], UserMessage)
    assert "Return a complete replacement JSON object." in retry_messages[3].content


def test_validation_retry_rebuilds_messages_without_provider_response_items():
    original_messages = [
        SystemMessage(content="Return schema JSON."),
        UserMessage(content='{"title":"ok"}'),
    ]
    provider_response_item = _ProviderResponseItem()
    invalid_response = {"title": "bad"}
    response = _FakeResponse(
        content=invalid_response,
        messages=[provider_response_item],
    )
    with pytest.raises(ValidationError) as exc:
        _RetrySchema.model_validate(invalid_response)

    retry_messages = _messages_for_model_validation_retry(
        messages=original_messages,
        response=response,
        label="slide layout",
        output_model=_RetrySchema,
        error=exc.value,
        invalid_response=invalid_response,
    )

    assert provider_response_item not in retry_messages
    assert retry_messages[:2] == original_messages
    assert isinstance(retry_messages[2], AssistantMessage)
    assert retry_messages[2].content == ['{\n  "title": "bad"\n}']
    assert isinstance(retry_messages[3], UserMessage)
    assert "required_json_schema:" in retry_messages[3].content
