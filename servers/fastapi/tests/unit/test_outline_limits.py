from models.presentation_outline_model import PresentationOutlineModel
from utils.outline_limits import normalize_outline_payload


def test_normalize_outline_payload_unwraps_json_encoded_slides_response():
    payload = {
        "slides": '{"slides":[{"content":"## Intro\\nA valid outline"}]}'
    }

    normalized = normalize_outline_payload(payload, max_slides=10)
    outline = PresentationOutlineModel.model_validate(normalized)

    assert [slide.content for slide in outline.slides] == ["## Intro\nA valid outline"]


def test_normalize_outline_payload_accepts_json_encoded_slides_array():
    payload = {"slides": '[{"content":"## Intro"}]'}

    normalized = normalize_outline_payload(payload, max_slides=10)

    assert normalized["slides"] == [{"content": "## Intro"}]


def test_normalize_outline_payload_leaves_non_json_slides_for_validation():
    payload = {"slides": "not JSON"}

    assert normalize_outline_payload(payload, max_slides=10) == payload
