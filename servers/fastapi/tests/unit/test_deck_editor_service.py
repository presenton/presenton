"""Unit-тесты services/deck_editor_service.py (без БД)."""

import copy
import uuid

import pytest

from services.deck_editor_service import (
    apply_editor_ops,
    collect_editor_elements,
    editor_view,
    element_rect,
    set_element_text,
    ui_is_editable,
)


def _slide_ui() -> dict:
    return {
        "id": "content_slide",
        "description": "Content slide",
        "components": [
            {
                "id": "main",
                "position": {"x": 0, "y": 0},
                "elements": [
                    {
                        "id": "title",
                        "type": "text",
                        "name": "title",
                        "position": {"x": 40, "y": 30},
                        "size": {"width": 600, "height": 80},
                        "font": {"size": 40, "color": "#000000"},
                        "text": "Hello",
                    },
                    {
                        "id": "picture",
                        "type": "image",
                        "name": "picture",
                        "position": {"x": 700, "y": 100},
                        "size": {"width": 400, "height": 300},
                        "data": "/app_data/images/users/x/photo.png",
                    },
                    {
                        "id": "accent",
                        "type": "vector",
                        "name": "accent",
                        "shape": "polygon",
                        "points": [
                            {"x": 40, "y": 500},
                            {"x": 140, "y": 500},
                            {"x": 140, "y": 600},
                        ],
                        "closed": True,
                        "fill": {"color": "#FF0000"},
                    },
                ],
            },
            {
                "id": "decor",
                "position": {"x": 0, "y": 0},
                "elements": [
                    {
                        "type": "vector",
                        "shape": "polygon",
                        "points": [
                            {"x": 0, "y": 0},
                            {"x": 100, "y": 0},
                            {"x": 100, "y": 100},
                        ],
                        "closed": True,
                        "fill": {"color": "#FFFFFF"},
                        "decorative": True,
                    }
                ],
            },
        ],
    }


def _paths(ui: dict) -> dict[str, str]:
    view = editor_view(ui, slide_id=str(uuid.uuid4()))
    paths: dict[str, str] = {}
    for element in view["elements"]:
        name = element.get("name") or element.get("type")
        if name:
            paths.setdefault(name, element["path"])
    return paths


def test_editor_view_flat_list_has_absolute_rects():
    view = editor_view(_slide_ui(), slide_id="s1")
    assert view["editable"] is True
    assert view["width"] == 1280 and view["height"] == 720
    by_name = {element["name"]: element for element in view["elements"] if element.get("name")}
    assert by_name["title"]["text"] == "Hello"
    assert by_name["title"]["rect"] == {"x": 40, "y": 30, "width": 600, "height": 80}
    assert by_name["picture"]["image"] == "/app_data/images/users/x/photo.png"
    # декоративные помечены
    decorative = [e for e in view["elements"] if e["decorative"]]
    assert decorative and decorative[0]["type"] == "vector"


def test_editor_view_rejects_non_ui_slide():
    view = editor_view({"content": {"title": "x"}}, slide_id="s1")
    assert view["editable"] is False
    assert view["elements"] == []


def test_set_text_writes_flat_text_and_runs():
    element = {"type": "text", "font": {"size": 12}, "text": "old"}
    set_element_text(element, "new")
    assert element["text"] == "new"
    assert element["runs"] == [{"text": "new", "font": {"size": 12}}]


def test_set_text_math_latex():
    element = {"type": "math", "latex": "x"}
    set_element_text(element, "E=mc^2")
    assert element["latex"] == "E=mc^2"


def test_apply_ops_set_text_and_move_clamps_to_stage():
    ui = copy.deepcopy(_slide_ui())
    paths = _paths(ui)
    apply_editor_ops(
        ui,
        [
            {"op": "set_text", "element_path": paths["title"], "text": "New"},
            {"op": "move", "element_path": paths["picture"], "position": {"x": -50, "y": 4000}},
        ],
    )
    by_name = {e["name"]: e for e in collect_editor_elements(ui) if e.get("name")}
    assert by_name["title"]["text"] == "New"
    rect = by_name["picture"]["rect"]
    assert rect["x"] == 0
    assert rect["y"] == 720


def test_apply_ops_vector_resize_scales_points():
    ui = copy.deepcopy(_slide_ui())
    vector_path = next(
        e["path"]
        for e in collect_editor_elements(ui)
        if e["type"] == "vector" and not e["decorative"]
    )
    apply_editor_ops(
        ui, [{"op": "resize", "element_path": vector_path, "size": {"width": 200, "height": 100}}]
    )
    vector = next(
        e for e in collect_editor_elements(ui) if e["type"] == "vector" and not e["decorative"]
    )
    assert vector["rect"] == {"x": 40, "y": 500, "width": 200, "height": 100}


def test_apply_ops_reject_decorative_ops():
    ui = copy.deepcopy(_slide_ui())
    vector_path = next(
        e["path"] for e in collect_editor_elements(ui) if e["type"] == "vector" and e["decorative"]
    )
    with pytest.raises(ValueError, match="decorative"):
        apply_editor_ops(ui, [{"op": "delete", "element_path": vector_path}])
    with pytest.raises(ValueError, match="decorative"):
        apply_editor_ops(
            ui,
            [{"op": "resize", "element_path": vector_path, "size": {"width": 50, "height": 50}}],
        )


def test_apply_ops_duplicate_and_delete_keep_paths_consistent():
    ui = copy.deepcopy(_slide_ui())
    paths = _paths(ui)
    apply_editor_ops(ui, [{"op": "duplicate", "element_path": paths["title"]}])
    elements = [e for e in collect_editor_elements(ui) if e.get("name") == "title"]
    assert len(elements) == 2
    assert elements[1]["id"] == "title_copy"
    apply_editor_ops(ui, [{"op": "delete", "element_path": elements[1]["path"]}])
    assert len([e for e in collect_editor_elements(ui) if e.get("name") == "title"]) == 1


def test_apply_ops_style_validation():
    ui = copy.deepcopy(_slide_ui())
    paths = _paths(ui)
    with pytest.raises(ValueError, match="hex color"):
        apply_editor_ops(
            ui,
            [
                {
                    "op": "set_style",
                    "element_path": paths["title"],
                    "patch": {"font": {"color": "blue"}},
                }
            ],
        )
    with pytest.raises(ValueError, match="not editable"):
        apply_editor_ops(
            ui,
            [{"op": "set_style", "element_path": paths["title"], "patch": {"shadow": {"blur": 5}}}],
        )
    with pytest.raises(ValueError, match="fill style"):
        apply_editor_ops(
            ui,
            [
                {
                    "op": "set_style",
                    "element_path": paths["title"],
                    "patch": {"fill": {"color": "#FF0000"}},
                }
            ],
        )


def test_apply_ops_set_image_url_validation():
    ui = copy.deepcopy(_slide_ui())
    paths = _paths(ui)
    with pytest.raises(ValueError, match="url must be"):
        apply_editor_ops(
            ui,
            [
                {
                    "op": "set_image_url",
                    "element_path": paths["picture"],
                    "url": "file:///etc/passwd",
                }
            ],
        )
    apply_editor_ops(
        ui,
        [
            {
                "op": "set_image_url",
                "element_path": paths["picture"],
                "url": "/app_data/images/users/x/new.png",
            }
        ],
    )
    picture = next(e for e in collect_editor_elements(ui) if e.get("name") == "picture")
    assert picture["image"] == "/app_data/images/users/x/new.png"


def test_apply_ops_unknown_op_raises():
    ui = copy.deepcopy(_slide_ui())
    with pytest.raises(ValueError, match="unknown op"):
        apply_editor_ops(ui, [{"op": "explode", "element_path": "components[0].elements[0]"}])


def test_ui_is_editable_requires_components_list():
    assert ui_is_editable(_slide_ui())
    assert not ui_is_editable({"id": "x"})
    assert not ui_is_editable(None)


def test_element_rect_missing_geometry_is_none():
    assert element_rect({"type": "text"}) is None


# ----------------------------------------------------------------------
# M4: rich text, add_element, set_data, view c ui/complex
# ----------------------------------------------------------------------
def test_set_text_supports_markdown_bold_and_keeps_runs_only():
    element = {"type": "text", "font": {"size": 24, "color": "#111111"}, "text": "old"}
    set_element_text(element, "Привет **мир**!")
    assert "text" not in element  # плоский текст убран: рендер читает runs
    bold_runs = [
        run
        for run in element["runs"]
        if isinstance(run.get("font"), dict) and run["font"].get("bold")
    ]
    assert len(bold_runs) == 1
    assert bold_runs[0]["text"] == "мир"
    plain = "".join(
        str(run.get("text") or "") for run in element["runs"] if run.get("text") is not None
    )
    assert plain == "Привет мир!"


def test_set_text_plain_keeps_flat_text():
    element = {"type": "text", "font": {"size": 24}, "text": "old"}
    set_element_text(element, "просто текст")
    assert element["text"] == "просто текст"
    assert element["runs"][0]["text"] == "просто текст"


def test_apply_ops_add_element_text_and_rectangle():
    ui = copy.deepcopy(_slide_ui())
    apply_editor_ops(
        ui,
        [
            {
                "op": "add_element",
                "type": "text",
                "rect": {"x": 100, "y": 100, "width": 400, "height": 120},
            },
            {
                "op": "add_element",
                "type": "rectangle",
                "rect": {"x": 600, "y": 400, "width": 300, "height": 150},
            },
        ],
    )
    elements = collect_editor_elements(ui)
    added_text = [e for e in elements if e.get("name") == "text_added"]
    added_rect = [e for e in elements if e.get("name") == "rectangle_added"]
    assert len(added_text) == 1
    assert added_text[0]["rect"]["x"] == 100
    assert added_text[0]["text"] == ""
    assert len(added_rect) == 1
    assert added_rect[0]["rect"] == {"x": 600, "y": 400, "width": 300, "height": 150}


def test_apply_ops_add_element_rejects_unknown_type():
    ui = copy.deepcopy(_slide_ui())
    with pytest.raises(ValueError, match="add_element type"):
        apply_editor_ops(ui, [{"op": "add_element", "type": "explosion"}])


def test_apply_ops_set_data_text_list():
    ui = copy.deepcopy(_slide_ui())
    # добавим text-list вручную в контейнер
    apply_editor_ops(
        ui,
        [{"op": "add_element", "type": "text"}],
    )
    container = ui["components"][0]["elements"]
    container.append({"type": "text-list", "font": {"size": 20}, "items": []})
    path = f"components[0].elements[{len(container) - 1}]"
    apply_editor_ops(
        ui, [{"op": "set_data", "element_path": path, "data": {"items": ["один", "два"]}}]
    )
    raw = next(
        element for element in ui["components"][0]["elements"] if element.get("type") == "text-list"
    )
    assert [item["runs"][0]["text"] for item in raw["items"]] == ["один", "два"]


def test_apply_ops_set_data_validates_text_list():
    ui = copy.deepcopy(_slide_ui())
    container = ui["components"][0]["elements"]
    container.append({"type": "text-list", "font": {"size": 20}, "items": []})
    path = f"components[0].elements[{len(container) - 1}]"
    with pytest.raises(ValueError, match="list of strings"):
        apply_editor_ops(ui, [{"op": "set_data", "element_path": path, "data": {"items": [1, 2]}}])


def test_editor_view_includes_ui_and_complex_preview():
    ui = copy.deepcopy(_slide_ui())
    container = ui["components"][0]["elements"]
    container.append(
        {
            "type": "chart",
            "categories": ["A", "B"],
            "series": [{"name": "s1", "data": [1, 2]}],
            "decorative": False,
        }
    )
    view = editor_view(ui, slide_id="s1")
    assert view["ui"] is ui
    chart = next(e for e in view["elements"] if e["type"] == "chart")
    assert chart["complex"] == {
        "kind": "chart",
        "categories": ["A", "B"],
        "series": [{"name": "s1", "data": [1, 2]}],
    }
