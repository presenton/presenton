import asyncio

import pytest

from models.presentation_layout import SlideLayoutModel
from models.presentation_outline_model import SlideOutlineModel
from utils.llm_calls import generate_slide_content


def _outline() -> SlideOutlineModel:
    return SlideOutlineModel(content="Slide outline")


def test_slide_content_prompt_keeps_visual_commands_out_of_output_fields():
    prompt = generate_slide_content.get_system_prompt(instructions="Create a bar chart on slide 5")

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


def test_build_slide_content_schemas_uses_soft_prompt_limits():
    response_schema = {
        "type": "object",
        "properties": {
            "heading": {"type": "string", "minLength": 10, "maxLength": 20},
            "items": {
                "type": "array",
                "items": {"type": "string", "minLength": 5, "maxLength": 9},
            },
        },
    }

    prompt_schema, provider_schema, validation_schema = (
        generate_slide_content.build_slide_content_schemas(response_schema)
    )

    assert prompt_schema["properties"]["heading"]["minLength"] == 16
    assert prompt_schema["properties"]["heading"]["maxLength"] == 16
    assert prompt_schema["properties"]["items"]["items"]["minLength"] == 7
    assert prompt_schema["properties"]["items"]["items"]["maxLength"] == 7
    assert provider_schema["properties"]["heading"]["minLength"] == 8
    assert "maxLength" not in provider_schema["properties"]["heading"]
    assert "minLength" not in validation_schema["properties"]["heading"]
    assert "maxLength" not in validation_schema["properties"]["heading"]
    assert response_schema["properties"]["heading"]["minLength"] == 10
    assert response_schema["properties"]["heading"]["maxLength"] == 20


def test_slide_content_prompt_includes_soft_targets_and_length_rules():
    prompt_schema, _, _ = generate_slide_content.build_slide_content_schemas(
        {
            "type": "object",
            "properties": {
                "heading": {"type": "string", "minLength": 10, "maxLength": 20}
            },
        }
    )

    prompt = generate_slide_content.get_system_prompt(response_schema=prompt_schema)

    # Форк: схема в промпте рендерится человекочитаемо (_describe_response_schema),
    # поэтому мягкие таргеты видны как границы "16..16 chars", а не сырой JSON.
    assert "16..16 chars" in prompt
    assert "aim for that exact count" in prompt
    assert "use a shorter natural value instead" in prompt


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
    provider_schema = captured["response_format"].json_schema
    assert provider_schema["properties"]["__speaker_note__"]["minLength"] == 80
    assert "maxLength" not in provider_schema["properties"]["__speaker_note__"]
    assert "minLength" not in captured["json_schema"]["properties"]["__speaker_note__"]
    assert "maxLength" not in captured["json_schema"]["properties"]["__speaker_note__"]
    assert captured["response_format"].strict is True
    assert "# Slide Number:\n2" in captured["messages"][1].content
