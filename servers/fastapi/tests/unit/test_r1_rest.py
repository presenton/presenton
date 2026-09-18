from fastapi import HTTPException
from services.r1_sources import extract_url_source

from services.r1_compositions import apply_composition, list_compositions
from services.r1_infographic import model_from_element
from services.r1_quality import check_presentation


def test_catalog_has_r1_layouts():
    ids = {item["id"] for item in list_compositions()}
    assert {"split-60-40", "matrix-2x2", "kpi-trend-takeaway", "decision"} <= ids


def test_apply_keeps_content():
    slide = {"layout": "blank", "layout_group": "blank", "content": {"title": "42 млн"}}
    next_slide = apply_composition(slide, "matrix-2x2")
    assert next_slide["layout"] == "matrix-2x2"
    assert next_slide["content"] == {"title": "42 млн"}


def test_infographic_nodes_separate():
    model = model_from_element({"type": "infographic", "infographic_type": "process", "labels": ["A", "B", "C"]})
    assert [n["label"] for n in model["nodes"]] == ["A", "B", "C"]
    assert len(model["edges"]) == 2


def test_quality_flags_placeholder_image():
    report = check_presentation({
        "slides": [{"id": "s1", "ui": {"el": {"type": "image", "data": "placeholder.jpg"}}, "content": {"title": "x"}}]
    })
    assert any(i["code"] == "empty_image" for i in report["issues"])


def test_url_extract_rejects_loopback():
    import pytest
    with pytest.raises(HTTPException) as exc:
        extract_url_source("http://127.0.0.1/")
    assert exc.value.status_code == 422
