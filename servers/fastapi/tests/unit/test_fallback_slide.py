import pytest

from models.presentation_layout import SlideLayoutModel
from models.presentation_outline_model import SlideOutlineModel
from utils.fallback_slide import (
    build_fallback_slide_content,
    build_fallback_speaker_note,
)

SCHEMA = {
    "type": "object",
    "properties": {
        "heading": {"type": "string", "minLength": 5, "maxLength": 40},
        "body": {"type": "string", "minLength": 20, "maxLength": 160},
        "bullet_points": {
            "type": "array",
            "minItems": 3,
            "maxItems": 5,
            "items": {"type": "string", "minLength": 4, "maxLength": 48},
        },
        "optional_field": {"type": "string", "maxLength": 30},
    },
    "required": ["heading", "body", "bullet_points"],
}

OUTLINE_TEXT = (
    "## Цифровая трансформация ритейла\n"
    "Рынок e-commerce вырос на 24% в 2024 году. Клиенты ожидают "
    "омниканальность и персонализацию. Внедрение ИИ-рекомендаций повышает "
    "конверсию. Логистика требует автоматизации складов. Мобильные платежи "
    "стали стандартом."
)


@pytest.fixture
def layout() -> SlideLayoutModel:
    return SlideLayoutModel(id="x", name="X", json_schema=SCHEMA)


@pytest.fixture
def outline() -> SlideOutlineModel:
    return SlideOutlineModel(content=OUTLINE_TEXT)


def test_fallback_fills_required_fields_and_respects_bounds(layout, outline):
    content = build_fallback_slide_content(layout, outline)
    assert set(content) == {"heading", "body", "bullet_points"}
    assert len(content["heading"]) <= 40
    assert len(content["body"]) >= 10
    assert len(content["bullet_points"]) == 3
    for point in content["bullet_points"]:
        assert 0 < len(point) <= 48


def test_fallback_does_not_clip_mid_word(layout, outline):
    content = build_fallback_slide_content(layout, outline)
    for value in [content["heading"], *content["bullet_points"]]:
        # Обрезка по maxLength не должна оставлять обрубок без пробела, если
        # в пределах лимита был хоть один пробел.
        assert not value.endswith(("ьн", "ани"))
    assert "  " not in content["body"]


def test_fallback_keeps_language_of_outline(layout, outline):
    content = build_fallback_slide_content(layout, outline)
    joined = " ".join([content["heading"], content["body"], *content["bullet_points"]])
    cyrillic = sum(1 for char in joined if "\u0400" <= char <= "\u04ff")
    latin = sum(1 for char in joined if char.isascii() and char.isalpha())
    assert cyrillic > latin


def test_fallback_with_empty_schema_returns_empty_dict(outline):
    layout = SlideLayoutModel(id="x", name="X", json_schema={})
    assert build_fallback_slide_content(layout, outline) == {}


def test_fallback_with_empty_outline(layout):
    outline = SlideOutlineModel(content="")
    content = build_fallback_slide_content(layout, outline)
    assert set(content) == {"heading", "body", "bullet_points"}


def test_speaker_note_from_outline(outline):
    note = build_fallback_speaker_note(outline)
    assert "Цифровая трансформация" in note
    assert len(note) <= 500


def test_speaker_note_empty_outline(outline):
    note = build_fallback_speaker_note(SlideOutlineModel(content=""))
    assert note
