import asyncio

import pytest

from models.presentation_layout import SlideLayoutModel
from models.presentation_outline_model import SlideOutlineModel
from utils.llm_calls import generate_slide_content


def _outline() -> SlideOutlineModel:
    return SlideOutlineModel(content="Slide outline")


def test_slide_content_prompt_keeps_visual_commands_out_of_output_fields():
    prompt = generate_slide_content.get_system_prompt(
        instructions="Create a bar chart on slide 5"
    )

    assert "visual instructions as production" in prompt
    assert "never emit those instructions" in prompt
    assert "populate the requested labels, series, and values" in prompt


def test_slide_content_user_prompt_includes_one_indexed_slide_number():
    prompt = generate_slide_content.get_user_prompt(
        "Slide outline",
        language="English",
        slide_number=1,
    )

    assert "# Slide Number:\n1" in prompt


def test_slide_content_generation_skips_schema_without_content_fields(monkeypatch):
    monkeypatch.setattr(
        generate_slide_content,
        "get_client",
        lambda **_kwargs: pytest.fail("LLM client should not be created"),
    )

    result = asyncio.run(
        generate_slide_content.get_slide_content_from_type_and_outline(
            SlideLayoutModel(
                id="decorative",
                json_schema={"title": "Decorative only"},
            ),
            _outline(),
            language="English",
        )
    )

    assert result == {}


def test_slide_content_generation_skips_asset_only_schema(monkeypatch):
    monkeypatch.setattr(
        generate_slide_content,
        "get_client",
        lambda **_kwargs: pytest.fail("LLM client should not be created"),
    )

    result = asyncio.run(
        generate_slide_content.get_slide_content_from_type_and_outline(
            SlideLayoutModel(
                id="asset-only",
                json_schema={
                    "type": "object",
                    "properties": {
                        "__image_url__": {"type": "string"},
                        "__icon_url__": {"type": "string"},
                    },
                    "required": ["__image_url__", "__icon_url__"],
                },
            ),
            _outline(),
            language="English",
        )
    )

    assert result == {}


def test_slide_content_generation_normalizes_object_schema_and_calls_llm(
    monkeypatch,
):
    captured = {}

    async def fake_generate_structured_with_schema_retries(
        _client,
        _model,
        *,
        response_format,
        json_schema,
        **_kwargs,
    ):
        captured["response_format"] = response_format
        captured["json_schema"] = json_schema
        captured["messages"] = _kwargs["messages"]
        return {
            "title": "Generated title",
            "__speaker_note__": "Speaker note",
        }

    monkeypatch.setattr(generate_slide_content, "get_client", lambda **_kwargs: object())
    monkeypatch.setattr(generate_slide_content, "get_llm_config", lambda: {})
    monkeypatch.setattr(generate_slide_content, "get_model", lambda: "test-model")
    monkeypatch.setattr(
        generate_slide_content,
        "generate_structured_with_schema_retries",
        fake_generate_structured_with_schema_retries,
    )

    result = asyncio.run(
        generate_slide_content.get_slide_content_from_type_and_outline(
            SlideLayoutModel(
                id="content",
                json_schema={
                    "title": "Content",
                    "properties": {
                        "title": {"type": "string"},
                    },
                    "required": ["title"],
                },
            ),
            _outline(),
            language="English",
            slide_number=2,
        )
    )

    assert result["title"] == "Generated title"
    assert captured["json_schema"]["type"] == "object"
    assert "__speaker_note__" in captured["json_schema"]["properties"]
    assert captured["response_format"].json_schema == captured["json_schema"]
    assert "# Slide Number:\n2" in captured["messages"][1].content
