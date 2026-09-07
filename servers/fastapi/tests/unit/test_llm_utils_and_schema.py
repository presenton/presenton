from utils.llm_utils import (
    extract_structured_content,
    get_generate_kwargs,
    serialize_structured_content,
)
from utils.schema_utils import (
    ensure_array_schemas_have_items,
    get_schema_validation_errors,
)


def test_extract_structured_content_from_json_text():
    payload = extract_structured_content('{"slides": [{"content": "A"}]}')
    assert payload == {"slides": [{"content": "A"}]}


def test_extract_structured_content_strips_markdown_fences():
    payload = extract_structured_content(
        'Here is the JSON:\n```json\n{"slides": [{"content": "A"}]}\n```'
    )
    assert payload == {"slides": [{"content": "A"}]}


def test_extract_structured_content_ignores_surrounding_prose():
    payload = extract_structured_content(
        'Sure! The layout is {"components": [{"id": "title"}]} as requested.'
    )
    assert payload == {"components": [{"id": "title"}]}


def test_extract_structured_content_returns_none_for_non_json_text():
    assert extract_structured_content("The model refused to answer.") is None


def test_extract_structured_content_dirty_json_still_parses():
    payload = extract_structured_content('{"a": 1,} trailing text')
    assert payload == {"a": 1}


def test_serialize_structured_content_prefers_json_serialization():
    serialized = serialize_structured_content({"slides": [{"content": "A"}]})
    assert serialized == '{"slides": [{"content": "A"}]}'


def test_get_generate_kwargs_includes_response_format_by_default(monkeypatch):
    monkeypatch.setenv("LLM", "ollama")
    monkeypatch.delenv("LLM_STRUCTURED_OUTPUTS", raising=False)
    response_format = object()

    kwargs = get_generate_kwargs("test-model", [], response_format=response_format)

    assert kwargs["response_format"] is response_format


def test_get_generate_kwargs_omits_response_format_when_disabled(monkeypatch):
    monkeypatch.setenv("LLM", "ollama")
    monkeypatch.setenv("LLM_STRUCTURED_OUTPUTS", "false")

    kwargs = get_generate_kwargs("test-model", [], response_format=object())

    assert "response_format" not in kwargs


def test_get_schema_validation_errors_reports_path_and_message():
    schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "maxLength": 5},
        },
        "required": ["title"],
        "additionalProperties": False,
    }
    errors = get_schema_validation_errors(schema, {"title": "too long title"}, strict=False)
    assert errors
    assert any("too long" in e.lower() for e in errors)


def test_ensure_array_schemas_have_items_adds_missing_items_recursively():
    schema = {
        "type": "object",
        "properties": {
            "slides": {
                "type": "array",
                "items": {"type": "object", "properties": {"tags": {"type": "array"}}},
            }
        },
    }

    fixed = ensure_array_schemas_have_items(schema)

    assert fixed["properties"]["slides"]["items"]["properties"]["tags"]["items"] == {
        "type": "string"
    }
