import pytest
from pydantic import TypeAdapter

from models.json_path_guide import DictGuide, JsonPathGuide, ListGuide
from utils.dict_utils import (
    deep_update,
    get_dict_at_path,
    get_dict_paths_with_key,
    has_more_than_n_keys,
    set_dict_at_path,
)


def test_get_dict_paths_with_key_finds_nested_dict_and_list():
    data = {
        "a": {"props": {"x": 1}},
        "b": [{"props": {"y": 2}}],
    }
    paths = get_dict_paths_with_key(data, "props")
    assert len(paths) == 2
    assert get_dict_at_path(data, paths[0]) == {"props": {"x": 1}}
    assert get_dict_at_path(data, paths[1]) == {"props": {"y": 2}}


def test_set_dict_at_path_dict_and_list_final_keys():
    one = {"level": {"final": 1}}
    set_dict_at_path(
        one,
        JsonPathGuide(guides=[DictGuide(key="level"), DictGuide(key="final")]),
        {"z": 9},
    )
    assert one["level"]["final"] == {"z": 9}

    two = {"items": [{"n": 0}]}
    set_dict_at_path(
        two,
        JsonPathGuide(guides=[DictGuide(key="items"), ListGuide(index=0)]),
        {"n": 1},
    )
    assert two["items"][0] == {"n": 1}

    three = {"rows": [{"a": 1}, {}]}
    set_dict_at_path(
        three,
        JsonPathGuide(guides=[DictGuide(key="rows"), ListGuide(index=1)]),
        {"patched": True},
    )
    assert three["rows"][1] == {"patched": True}

    nested_lists = {"a": [[{}, {"reserved": False}]]}
    set_dict_at_path(
        nested_lists,
        JsonPathGuide(
            guides=[
                DictGuide(key="a"),
                ListGuide(index=0),
                ListGuide(index=1),
            ]
        ),
        {"filled": True},
    )
    assert nested_lists["a"][0][1] == {"filled": True}


def test_set_dict_at_path_empty_guides_is_noop():
    data = {"a": 1}
    set_dict_at_path(data, JsonPathGuide(guides=[]), {"x": 2})
    assert data == {"a": 1}


def test_has_more_than_n_keys():
    assert has_more_than_n_keys({"a": 1, "b": 2}, n=1) is True
    assert has_more_than_n_keys({"a": 1}, n=1) is False


@pytest.mark.parametrize(
    ("original", "updates", "expected"),
    [
        ({"a": {"x": 1}}, {"a": {"y": 2}}, {"a": {"x": 1, "y": 2}}),
        ({"a": [1, 2]}, {"a": []}, {"a": [1, 2]}),
        ({"a": [{"k": 1}]}, {"a": [{"k": 2}]}, {"a": [{"k": 2}]}),
        ({"a": [1, 2]}, {"a": [9, 8, 7]}, {"a": [9, 8]}),
        ({"a": 1}, {"a": 2}, {"a": 2}),
        ({}, {"b": 3}, {"b": 3}),
        ({"nested": {}}, {}, {"nested": {}}),
    ],
)
def test_deep_update_modes(original: dict, updates: dict, expected: dict):
    assert deep_update(original, updates) == expected


def test_deep_update_deeply_nested_lists_of_dicts():
    original = {"slides": [{"a": {"x": 1}}, {"b": 2}]}
    updates = {"slides": [{"a": {"x": 2}}, {"b": 3}]}
    assert deep_update(original, updates) == {"slides": [{"a": {"x": 2}}, {"b": 3}]}


def test_deep_update_single_dict_into_list_slot_with_scalar_original():
    assert deep_update({"a": [99]}, {"a": [{"k": True}]}) == {"a": [{"k": True}]}


def test_json_path_guide_type_adapter_round_trip():
    guide = JsonPathGuide(guides=[DictGuide(key="x"), ListGuide(index=0), DictGuide(key="y")])
    dumped = guide.model_dump()
    restored = TypeAdapter(JsonPathGuide).validate_python(dumped)
    assert restored == guide
