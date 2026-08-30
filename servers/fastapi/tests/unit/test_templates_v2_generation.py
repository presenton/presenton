import json
import logging
from types import SimpleNamespace

import pytest
from llmai.shared import (
    AssistantMessage,
    AssistantToolCall,
    GoogleClientConfig,
    ImageContentPart,
    SystemMessage,
    ToolResponseMessage,
    UserMessage,
)
from pydantic import BaseModel, Field, ValidationError

from templates.v2.generation import (
    CLUSTER_SIMILAR_COMPONENTS_SYSTEM_PROMPT,
    CONTENT_ICON_PLACEHOLDER_URL,
    CONTENT_IMAGE_PLACEHOLDER_URL,
    GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT,
    _generate_preview_candidate,
    _messages_for_json_repair_retry,
    _messages_for_model_validation_retry,
    _slide_image_content,
    _validate_similarity_groups,
    generate_slide_layout,
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


def _generated_layout_with_images() -> dict:
    layout = _generated_layout("image_slide")
    layout["components"][0]["elements"] = [
        {
            "type": "image",
            "position": {"x": 0, "y": 0},
            "size": {"width": 320, "height": 180},
            "decorative": False,
            "name": "hero_image",
            "data": "/app_data/images/source-photo.png",
            "prompt": "Team reviewing dashboard",
            "is_icon": False,
        },
        {
            "type": "image",
            "position": {"x": 340, "y": 0},
            "size": {"width": 48, "height": 48},
            "decorative": False,
            "name": "status_icon",
            "data": "/app_data/icons/source-icon.svg",
            "prompt": "growth chart",
            "is_icon": True,
        },
        {
            "type": "image",
            "position": {"x": 400, "y": 0},
            "size": {"width": 80, "height": 40},
            "decorative": True,
            "name": "logo",
            "data": "/app_data/images/logo.png",
            "is_icon": False,
        },
        {
            "type": "group",
            "position": {"x": 0, "y": 220},
            "size": {"width": 180, "height": 120},
            "name": "nested_media",
            "children": [
                {
                    "type": "image",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 180, "height": 120},
                    "decorative": False,
                    "name": "nested_image",
                    "data": "/app_data/images/nested-photo.png",
                    "is_icon": False,
                }
            ],
        },
    ]
    return layout


def _contains_key(value, key: str) -> bool:
    if isinstance(value, dict):
        return key in value or any(
            _contains_key(child, key) for child in value.values()
        )
    if isinstance(value, list):
        return any(_contains_key(item, key) for item in value)
    return False


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


def test_generate_slide_layout_requests_complete_layout(monkeypatch, caplog):
    preview_tool_call = AssistantToolCall(
        id="preview-call-1",
        name="previewSlide",
        arguments=json.dumps(_generated_layout()),
    )
    client = _FakeClient(
        responses=[
            _FakeResponse(None, tool_calls=[preview_tool_call]),
            _FakeResponse(_generated_layout()),
        ]
    )
    monkeypatch.setattr("templates.v2.generation.get_client", lambda **_kwargs: client)
    monkeypatch.setattr("templates.v2.generation.get_llm_config", lambda: {})
    monkeypatch.setattr("templates.v2.generation.get_model", lambda: "test-model")
    monkeypatch.setattr(
        PreviewSlideTool,
        "render",
        lambda _self, _layout: ImageContentPart(
            data=b"rendered-preview",
            mime_type="image/png",
        ),
    )
    caplog.set_level(logging.INFO, logger="templates.v2.generation")

    result = generate_slide_layout(
        _raw_layout(),
        2,
        "https://example.com/slide-3.png",
    )

    assert result == SlideLayout.model_validate(_generated_layout())
    result_element = result.model_dump(mode="json")["components"][0]["elements"][0]
    assert result_element["decorative"] is False
    assert "fixed" not in result_element
    assert len(client.calls) == 2
    preview_call = client.calls[0]
    assert isinstance(preview_call["tools"][0], PreviewSlideTool)
    assert preview_call["tools"][0].input_schema is SlideLayout
    assert preview_call["tool_choice"] == {
        "mode": "auto",
        "tools": ["previewSlide"],
    }
    assert (
        preview_call["response_format"].json_schema
        == slide_layout_llm_json_schema()
    )
    assert preview_call["response_format"].name == "SlideLayoutResponse"
    assert "max_tokens" not in preview_call
    assert preview_call["messages"][0].content == GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    user_content = preview_call["messages"][1].content
    assert user_content[0].url == "https://example.com/slide-3.png"
    payload = json.loads(user_content[1])
    assert payload[0]["id"] == "source_slide"
    assert payload[0]["elements"][0]["runs"][0]["text"] == (
        "Original title"
    )
    assert not _contains_key(payload, "decorative")

    final_call = client.calls[1]
    assert (
        final_call["response_format"].json_schema
        == slide_layout_llm_json_schema()
    )
    assert final_call["response_format"].name == "SlideLayoutResponse"
    assert "max_tokens" not in final_call
    assert isinstance(final_call["messages"][-2], ToolResponseMessage)
    feedback = final_call["messages"][-1]
    assert isinstance(feedback, UserMessage)
    assert feedback.content[0].data == b"rendered-preview"
    assert "Review this rendered candidate" in feedback.content[1]
    messages = [record.getMessage() for record in caplog.records]
    assert any("slide 3: preview slide called" in message for message in messages)
    assert any("slide 3: preview slide rendered" in message for message in messages)
    assert any("slide 3: slide layout JSON returned" in message for message in messages)


def test_generate_slide_layout_accepts_direct_schema_response(monkeypatch, caplog):
    client = _FakeClient(responses=[_FakeResponse(_generated_layout())])
    monkeypatch.setattr("templates.v2.generation.get_client", lambda **_kwargs: client)
    monkeypatch.setattr("templates.v2.generation.get_llm_config", lambda: {})
    monkeypatch.setattr("templates.v2.generation.get_model", lambda: "test-model")
    monkeypatch.setattr(
        PreviewSlideTool,
        "render",
        lambda _self, _layout: pytest.fail("preview should not be rendered"),
    )
    caplog.set_level(logging.INFO, logger="templates.v2.generation")

    result = generate_slide_layout(
        _raw_layout(),
        0,
        "https://example.com/slide-1.png",
    )

    assert result == SlideLayout.model_validate(_generated_layout())
    assert len(client.calls) == 1
    call = client.calls[0]
    assert call["tool_choice"] == {
        "mode": "auto",
        "tools": ["previewSlide"],
    }
    assert (
        call["response_format"].json_schema
        == slide_layout_llm_json_schema()
    )
    assert call["response_format"].name == "SlideLayoutResponse"
    messages = [record.getMessage() for record in caplog.records]
    assert any("slide 1: slide layout JSON returned" in message for message in messages)


def test_generate_slide_layout_replaces_content_image_urls(monkeypatch):
    client = _FakeClient(responses=[_FakeResponse(_generated_layout_with_images())])
    monkeypatch.setattr("templates.v2.generation.get_client", lambda **_kwargs: client)
    monkeypatch.setattr("templates.v2.generation.get_llm_config", lambda: {})
    monkeypatch.setattr("templates.v2.generation.get_model", lambda: "test-model")
    monkeypatch.setattr(
        PreviewSlideTool,
        "render",
        lambda _self, _layout: pytest.fail("preview should not be rendered"),
    )

    result = generate_slide_layout(
        _raw_layout(),
        0,
        "https://example.com/slide-1.png",
    )

    elements = result.model_dump(mode="json")["components"][0]["elements"]
    assert elements[0]["data"] == CONTENT_IMAGE_PLACEHOLDER_URL
    assert elements[0]["fit"] == "cover"
    assert elements[0]["prompt"] == "Team reviewing dashboard"
    assert elements[1]["data"] == CONTENT_ICON_PLACEHOLDER_URL
    assert elements[1]["prompt"] == "growth chart"
    assert elements[2]["data"] == "/app_data/images/logo.png"
    assert elements[3]["children"][0]["data"] == CONTENT_IMAGE_PLACEHOLDER_URL
    assert elements[3]["children"][0]["fit"] == "cover"


def test_generate_slide_layout_passes_max_tokens_when_provided(monkeypatch):
    client = _FakeClient(responses=[_FakeResponse(_generated_layout())])
    monkeypatch.setattr("templates.v2.generation.get_client", lambda **_kwargs: client)
    monkeypatch.setattr("templates.v2.generation.get_llm_config", lambda: {})
    monkeypatch.setattr("templates.v2.generation.get_model", lambda: "test-model")
    monkeypatch.setattr(
        PreviewSlideTool,
        "render",
        lambda _self, _layout: pytest.fail("preview should not be rendered"),
    )

    result = generate_slide_layout(
        _raw_layout(),
        0,
        "https://example.com/slide-1.png",
        max_tokens=16000,
    )

    assert result == SlideLayout.model_validate(_generated_layout())
    assert client.calls[0]["max_tokens"] == 16000


def test_generate_slide_layout_uses_json_schema_response_for_google(monkeypatch):
    client = _FakeClient(responses=[_FakeResponse(_generated_layout())])
    monkeypatch.setattr("templates.v2.generation.get_client", lambda **_kwargs: client)
    monkeypatch.setattr(
        "templates.v2.generation.get_llm_config",
        lambda: GoogleClientConfig(api_key="test-key"),
    )
    monkeypatch.setattr("templates.v2.generation.get_model", lambda: "gemini-test")
    monkeypatch.setattr(
        PreviewSlideTool,
        "render",
        lambda _self, _layout: pytest.fail("preview should not be rendered"),
    )

    result = generate_slide_layout(
        _raw_layout(),
        0,
        "https://example.com/slide-1.png",
    )

    assert result == SlideLayout.model_validate(_generated_layout())
    call = client.calls[0]
    assert (
        call["response_format"].json_schema
        == slide_layout_llm_json_schema()
    )
    assert call["response_format"].name == "SlideLayoutResponse"
    assert call["messages"][0].content == GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT


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


def test_generate_slide_layout_allows_second_preview_then_returns_final_json(
    monkeypatch,
    caplog,
):
    first_preview_tool_call = AssistantToolCall(
        id="preview-call-1",
        name="previewSlide",
        arguments=json.dumps(_generated_layout("first_candidate")),
    )
    second_preview_tool_call = AssistantToolCall(
        id="preview-call-2",
        name="previewSlide",
        arguments=json.dumps(_generated_layout("second_candidate")),
    )
    client = _FakeClient(
        responses=[
            _FakeResponse(None, tool_calls=[first_preview_tool_call]),
            _FakeResponse(None, tool_calls=[second_preview_tool_call]),
            _FakeResponse(_generated_layout("final_candidate")),
        ]
    )
    render_calls = []

    def fake_render(_self, layout):
        render_calls.append(layout.id)
        return ImageContentPart(
            data=b"rendered-preview",
            mime_type="image/png",
        )

    monkeypatch.setattr("templates.v2.generation.get_client", lambda **_kwargs: client)
    monkeypatch.setattr("templates.v2.generation.get_llm_config", lambda: {})
    monkeypatch.setattr("templates.v2.generation.get_model", lambda: "test-model")
    monkeypatch.setattr(PreviewSlideTool, "render", fake_render)
    caplog.set_level(logging.INFO, logger="templates.v2.generation")

    result = generate_slide_layout(
        _raw_layout(),
        0,
        "https://example.com/slide-1.png",
    )

    assert result == SlideLayout.model_validate(_generated_layout("final_candidate"))
    assert render_calls == ["first_candidate", "second_candidate"]
    assert len(client.calls) == 3
    second_call = client.calls[1]
    assert isinstance(second_call["messages"][-2], ToolResponseMessage)
    assert second_call["messages"][-2].id == "preview-call-1"
    second_feedback = second_call["messages"][-1]
    assert isinstance(second_feedback, UserMessage)
    assert second_feedback.content[0].data == b"rendered-preview"
    assert "one more time" in second_feedback.content[1]
    third_call = client.calls[2]
    assert "tools" not in third_call
    assert "tool_choice" not in third_call
    assert isinstance(third_call["messages"][-2], ToolResponseMessage)
    assert third_call["messages"][-2].id == "preview-call-2"
    final_feedback = third_call["messages"][-1]
    assert isinstance(final_feedback, UserMessage)
    assert final_feedback.content[0].data == b"rendered-preview"
    assert "maximum number of previewSlide calls" in final_feedback.content[1]
    messages = [record.getMessage() for record in caplog.records]
    assert any("slide 1: preview slide called" in message for message in messages)
    assert any("preview_call=2" in message for message in messages)
    assert any(
        "slide 1: slide layout JSON returned" in message
        for message in messages
    )


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
    caplog.set_level(logging.INFO, logger="templates.v2.generation")

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
    assert call["response_format"].json_schema.__name__ == "SimilarComponentsList"
    assert call["response_format"].name == "SimilarComponentsResponse"
    assert call["messages"][0].content == CLUSTER_SIMILAR_COMPONENTS_SYSTEM_PROMPT
    payload = json.loads(call["messages"][1].content)
    assert payload == {
        "components": [
            {
                "index": 0,
                "id": "title_block",
                "description": (
                    "Reusable prominent title text block for opening slides."
                ),
            },
            {
                "index": 1,
                "id": "metric_grid",
                "description": (
                    "Reusable grid presenting several business metrics and labels."
                ),
            },
            {
                "index": 2,
                "id": "section_heading",
                "description": (
                    "Reusable prominent heading text block for section slides."
                ),
            },
        ]
    }
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


def test_direct_generation_prompt_uses_decorative_element_metadata():
    assert "Convert the provided raw slide elements to components" in (
        GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    )
    assert "# Decorative and Content Element Rules:" in (
        GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    )
    assert "`decorative=true`" in GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    assert "`decorative=false`" in GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    assert "fixed visual scaffolding" in GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    assert "connector and branching lines" in GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    assert "a ring around a replaceable topic icon is decorative" in (
        GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    )


def test_direct_generation_prompt_covers_repeatable_layout_capacity_and_infographics():
    prompt = GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT

    assert "# Regular Repeatable Region Rules:" in prompt
    assert "one complete representative child prototype" in prompt
    assert "# Repeatable Timeline and Staggered Item Rules:" in prompt
    assert "Order repeated item groups from the center outward" in prompt
    assert "# Connector and Vector Path Rules:" in prompt
    assert "# Content Capacity and Min/Max Rules:" in prompt
    assert "sum(item widths) + sum(gaps)" in prompt
    assert "An `infographic` renders the graphic only" in prompt
    assert "valid `data` object" in prompt
    assert "# Final Layout Self-Check:" in prompt
    assert "minimum-content state" in prompt
    assert "Must use `previewSlide` tool at least once" in prompt


def test_component_clustering_prompt_uses_structure_instead_of_example_content():
    prompt = CLUSTER_SIMILAR_COMPONENTS_SYSTEM_PROMPT

    assert "same structural role" in prompt
    assert "Ignore the example content entirely" in prompt
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
