from models.presentation_outline_model import PresentationOutlineModel
from utils.outline_limits import (
    normalize_generated_outline_content,
    normalize_outline_payload,
)


def test_normalize_outline_payload_unwraps_json_encoded_slides_response():
    payload = {
        "slides": '{"slides":[{"content":"## Intro\\nA valid outline"}]}'
    }

    normalized = normalize_outline_payload(payload, max_slides=10)
    outline = PresentationOutlineModel.model_validate(normalized)

    assert [slide.content for slide in outline.slides] == [
        "## Intro\n- A valid outline"
    ]


def test_normalize_outline_payload_accepts_json_encoded_slides_array():
    payload = {"slides": '[{"content":"## Intro"}]'}

    normalized = normalize_outline_payload(payload, max_slides=10)

    assert normalized["slides"] == [{"content": "## Intro"}]


def test_normalize_outline_payload_leaves_non_json_slides_for_validation():
    payload = {"slides": "not JSON"}

    assert normalize_outline_payload(payload, max_slides=10) == payload


def test_normalize_generated_outline_content_decodes_tokens_and_marks_bare_lines():
    assert normalize_generated_outline_content(
        "## Roadmap<LINE_BREAK>Opening overview<LINE_BREAK>1. First milestone"
    ) == "## Roadmap\n- Opening overview\n1. First milestone"


def test_normalize_outline_payload_normalizes_generated_markdown():
    normalized = normalize_outline_payload(
        {
            "slides": [
                {
                    "content": "## Roadmap<LINE_BREAK>Opening overview",
                    "layout": "hero",
                }
            ]
        },
        max_slides=10,
    )

    assert normalized["slides"] == [
        {"content": "## Roadmap\n- Opening overview", "layout": "hero"}
    ]
