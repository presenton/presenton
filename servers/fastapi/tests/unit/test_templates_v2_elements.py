import pytest
from pydantic import ValidationError

from templates.v2.models.elements import (
    Chart,
    Container,
    Image,
    Infographic,
    MathExpression,
    ProgressBarInfographicData,
    Table,
    Text,
    TextList,
    Vector,
    VectorShape,
)
from templates.v2.models.layouts import RawSlideLayout


def test_math_expression_is_a_first_class_slide_element():
    layout = RawSlideLayout.model_validate(
        {
            "id": "formula_slide",
            "description": "Layout with an editable equation.",
            "elements": [
                {
                    "type": "container",
                    "child": {
                        "type": "math",
                        "decorative": False,
                        "name": "formula",
                        "latex": r"\frac{x_i^2}{\sum_{j=1}^n y_j}",
                        "position": {"x": 20, "y": 40},
                        "size": {"width": 640, "height": 120},
                        "font": {"size": 42, "color": "#111827"},
                        "alignment": {
                            "horizontal": "center",
                            "vertical": "middle",
                        },
                    },
                }
            ],
        }
    )

    formula = layout.elements[0].child
    assert isinstance(formula, MathExpression)
    assert formula.latex == r"\frac{x_i^2}{\sum_{j=1}^n y_j}"
    assert formula.display_mode is True
    assert layout.model_dump(mode="json")["elements"][0]["child"]["type"] == "math"


def test_math_expression_rejects_empty_or_oversized_latex():
    base = {
        "type": "math",
        "decorative": False,
        "name": "formula",
    }
    with pytest.raises(ValidationError, match="latex"):
        MathExpression.model_validate({**base, "latex": ""})
    with pytest.raises(ValidationError, match="latex"):
        MathExpression.model_validate({**base, "latex": "x" * 4001})


def test_chart_accepts_legacy_boolean_data_labels():
    chart = Chart.model_validate(
        {
            "type": "chart",
            "decorative": False,
            "name": "legacy_chart",
            "chart_type": "bar",
            "data_labels": True,
        }
    )
    assert chart.data_labels is not None
    assert chart.data_labels.value == "top"

    hidden = Chart.model_validate(
        {
            "type": "chart",
            "decorative": False,
            "name": "legacy_chart",
            "chart_type": "bar",
            "data_labels": False,
        }
    )
    assert hidden.data_labels is None

    layout = RawSlideLayout.model_validate(
        {
            "id": "legacy_chart_data_labels",
            "description": "Layout with legacy boolean chart data labels.",
            "elements": [
                {
                    "type": "chart",
                    "decorative": False,
                    "name": "legacy_chart",
                    "chart_type": "bar",
                    "data_labels": True,
                }
            ],
        }
    )
    layout_chart = layout.elements[0]
    assert isinstance(layout_chart, Chart)
    assert layout_chart.data_labels is not None
    assert layout_chart.data_labels.value == "top"


def test_image_element_accepts_flip_flags():
    image = Image.model_validate(
        {
            "type": "image",
            "decorative": False,
            "name": "hero",
            "is_icon": False,
            "data": "/app_data/images/hero.png",
            "flip_h": True,
            "flip_v": False,
            "focus_x": 20.0,
            "focus_y": 75.0,
            "crop_scale": 1.8,
            "clip_path": "path('M 0 0 L 100 0 L 100 100 Z')",
            "icon_type": "duotone",
        }
    )
    assert image.flip_h is True
    assert image.flip_v is False
    assert image.focus_x == 20.0
    assert image.focus_y == 75.0
    assert image.crop_scale == 1.8
    assert image.clip_path == "path('M 0 0 L 100 0 L 100 100 Z')"
    assert image.icon_type is not None
    assert image.icon_type.value == "duotone"

    layout = RawSlideLayout.model_validate(
        {
            "id": "flipped_image_slide",
            "description": "Layout with a flipped image.",
            "elements": [
                {
                    "type": "image",
                    "decorative": False,
                    "name": "hero",
                    "is_icon": False,
                    "data": "/app_data/images/hero.png",
                    "flip_h": True,
                    "flip_v": False,
                    "focus_x": 20.0,
                    "focus_y": 75.0,
                    "crop_scale": 1.8,
                    "clip_path": "path('M 0 0 L 100 0 L 100 100 Z')",
                    "icon_type": "duotone",
                }
            ],
        }
    )
    layout_image = layout.elements[0]
    assert layout_image.flip_h is True
    assert layout_image.flip_v is False
    assert layout_image.focus_x == 20.0
    assert layout_image.focus_y == 75.0
    assert layout_image.crop_scale == 1.8
    assert layout_image.clip_path == "path('M 0 0 L 100 0 L 100 100 Z')"
    assert layout_image.icon_type is not None
    assert layout_image.icon_type.value == "duotone"
    assert (
        layout.model_dump(mode="json")["elements"][0]["clip_path"]
        == "path('M 0 0 L 100 0 L 100 100 Z')"
    )
    assert layout.model_dump(mode="json")["elements"][0]["icon_type"] == "duotone"

    with pytest.raises(ValidationError, match="icon_type"):
        Image.model_validate(
            {
                "type": "image",
                "decorative": False,
                "name": "hero",
                "is_icon": True,
                "data": "/app_data/images/hero.png",
                "icon_type": "heavy",
            }
        )


@pytest.mark.parametrize("element_type", ["line", "rectangle", "ellipse", "circle"])
def test_legacy_geometry_is_not_adapted_to_vectors(element_type: str):
    with pytest.raises(ValidationError):
        RawSlideLayout.model_validate(
            {
                "id": "legacy_geometry",
                "description": "Layout with legacy straight-edged geometry.",
                "elements": [
                    {
                        "type": element_type,
                        "position": {"x": 20, "y": 40},
                        "size": {"width": 160, "height": 80},
                        "fill": {"color": "#F4F3FF"},
                        "stroke": {"color": "#7A5AF8", "width": 2},
                    },
                ],
            }
        )


def test_vector_accepts_smooth_curves_only():
    layout = RawSlideLayout.model_validate(
        {
            "id": "curved_geometry",
            "description": "Layout with editable curved vector shapes.",
            "elements": [
                {
                    "type": "vector",
                    "points": [
                        {"x": 0, "y": 0},
                        {"x": 50, "y": 100},
                        {"x": 100, "y": 0},
                    ],
                    "closed": False,
                    "curve": {"type": "smooth", "tension": 0.5, "segments": 12},
                    "stroke": {"color": "#111111", "width": 2},
                },
            ],
        }
    )

    (smooth,) = layout.elements
    assert isinstance(smooth, Vector)
    assert smooth.curve is not None
    assert smooth.curve.type == "smooth"
    assert smooth.curve.tension == 0.5
    assert smooth.curve.segments == 12

    with pytest.raises(ValidationError):
        RawSlideLayout.model_validate(
            {
                "id": "unsupported_curve",
                "description": "Bezier curves are no longer supported.",
                "elements": [
                    {
                        "type": "vector",
                        "points": [{"x": 0, "y": 0}, {"x": 100, "y": 0}],
                        "closed": False,
                        "curve": {
                            "type": "beizer",
                            "segments": 8,
                            "control_points": [{"x": 50, "y": -60}],
                        },
                        "stroke": {"color": "#222222", "width": 2},
                    },
                ],
            }
        )


def test_vector_accepts_polygon_and_ellipse_shapes_only():
    ellipse = Vector.model_validate(
        {
            "type": "vector",
            "shape": "ellipse",
            "points": [{"x": 0, "y": 0}, {"x": 100, "y": 80}],
            "fill": {"color": "#F4F3FF"},
        }
    )

    assert ellipse.shape == VectorShape.ELLIPSE

    polygon = Vector.model_validate(
        {
            "type": "vector",
            "shape": "polygon",
            "points": [{"x": 0, "y": 0}, {"x": 100, "y": 80}],
            "stroke": {"color": "#111111", "width": 2},
        }
    )

    assert polygon.shape == VectorShape.POLYGON

    with pytest.raises(ValidationError):
        Vector.model_validate(
            {
                "type": "vector",
                "shape": "rect",
                "points": [{"x": 0, "y": 0}, {"x": 100, "y": 80}],
                "fill": {"color": "#F4F3FF"},
            }
        )


def test_element_models_match_export_schema_changes():
    assert "decorative" not in Container.model_fields
    assert not {
        "data",
        "color",
        "label_color",
        "show_values",
    }.intersection(Chart.model_fields)
    assert "axis_color" in Chart.model_fields
    assert "title_color" in Chart.model_fields
    assert "legend_color" in Chart.model_fields
    assert "legend" in Chart.model_fields
    assert {"data", "colors"}.issubset(Infographic.model_fields)
    assert not {
        "infographic_type",
        "max_value",
        "min_value",
        "value",
        "base_color",
        "highlight_color",
    }.intersection(Infographic.model_fields)

    chart = Chart.model_validate(
        {
            "type": "chart",
            "decorative": False,
            "name": "model_chart",
            "chart_type": "bar",
            "title": "Revenue",
            "title_color": "#102030",
            "legend_color": "#405060",
        }
    )
    assert chart.title_color == "#102030"
    assert chart.legend_color == "#405060"

    with pytest.raises(ValidationError, match="runs"):
        Text.model_validate(
            {
                "type": "text",
                "decorative": False,
                "name": "title",
                "min_length": 1,
                "max_length": 10,
            }
        )

    with pytest.raises(ValidationError, match="items"):
        TextList.model_validate(
            {
                "type": "text-list",
                "decorative": False,
                "name": "bullets",
                "min_items": 1,
                "max_items": 2,
                "min_item_length": 1,
                "max_item_length": 10,
            }
        )

    with pytest.raises(ValidationError, match="data"):
        Image.model_validate(
            {
                "type": "image",
                "decorative": False,
                "name": "hero",
                "is_icon": False,
            }
        )

    table = Table.model_validate(
        {
            "type": "table",
            "decorative": False,
            "name": "metrics",
            "columns": [
                {"runs": [{"text": "Metric"}]},
                {"runs": [{"text": "Value"}]},
            ],
            "rows": [
                [
                    {"runs": [{"text": "Revenue"}]},
                    {"runs": [{"text": "$12M"}]},
                ]
            ],
            "min_columns": 1,
            "max_columns": 2,
            "min_rows": 1,
            "max_rows": 1,
        }
    )
    assert [cell.runs[0].text for cell in table.columns] == ["Metric", "Value"]

    with pytest.raises(ValidationError):
        Table.model_validate(
            {
                "type": "table",
                "decorative": False,
                "name": "metrics",
                "columns": [{"text": "Metric"}],
                "rows": [["Revenue"]],
                "min_columns": 1,
                "max_columns": 1,
                "min_rows": 1,
                "max_rows": 1,
            }
        )

    infographic = Infographic.model_validate(
        {
            "type": "infographic",
            "decorative": False,
            "name": "progress",
            "data": {
                "type": "progress_bar",
                "min_value": 0,
                "max_value": 100,
                "value": 70,
            },
            "colors": ["E5E7EB", "2563EB"],
        }
    )
    assert infographic.type == "infographic"
    assert infographic.decorative is False
    assert isinstance(infographic.data, ProgressBarInfographicData)
    assert infographic.data.type == "progress_bar"
    assert infographic.data.value == 70
    assert infographic.colors == ["E5E7EB", "2563EB"]

    with pytest.raises(ValidationError):
        Infographic.model_validate(
            {
                "type": "infographics",
                "decorative": False,
                "name": "progress",
                "data": {
                    "type": "progress_bar",
                    "min_value": 0,
                    "max_value": 100,
                    "value": 70,
                },
            }
        )


def test_chart_rejects_tiny_explicit_size():
    with pytest.raises(ValidationError, match="chart size"):
        Chart.model_validate(
            {
                "type": "chart",
                "decorative": False,
                "name": "model_chart",
                "chart_type": "bar",
                "position": {"x": 0.25, "y": 0.2},
                "size": {"width": 0.6, "height": 0.5},
                "categories": ["GPT OSS 20B", "GPT OSS 120B"],
                "series": [{"name": "Score", "values": [20, 120]}],
            }
        )

    chart = Chart.model_validate(
        {
            "type": "chart",
            "decorative": False,
            "name": "model_chart",
            "chart_type": "bar",
            "position": {"x": 0, "y": 0},
            "size": {"width": 640, "height": 300},
            "categories": ["GPT OSS 20B", "GPT OSS 120B"],
            "series": [{"name": "Score", "values": [20, 120]}],
            "legend": False,
        }
    )
    assert chart.size.width == 640
    assert chart.legend is False


def test_pie_and_donut_ignore_additional_series():
    for chart_type in ("pie", "donut"):
        chart = Chart(
            type="chart",
            decorative=False,
            name="single-series-chart",
            chart_type=chart_type,
            colors=["#FF0000", "#00FF00"],
            categories=["A", "B"],
            series=[
                {"name": "Used", "values": [10, 20]},
                {"name": "Ignored", "values": [30, 40]},
            ],
        )

        assert chart.series is not None
        assert [series.name for series in chart.series] == ["Used"]


def test_raw_layout_accepts_reference_converter_element_models():
    layout = RawSlideLayout.model_validate(
        {
            "id": "pptx_slide",
            "description": "Layout converted from a PowerPoint source slide.",
            "elements": [
                {
                    "type": "image",
                    "decorative": True,
                    "name": "background",
                    "is_icon": False,
                    "opacity": 0.42,
                    "data": "/app_data/images/background.png",
                },
                {
                    "type": "table",
                    "decorative": False,
                    "name": "financials",
                    "columns": [
                        {"runs": [{"text": "Metric"}]},
                        {"runs": [{"text": "Value"}]},
                    ],
                    "rows": [
                        [
                            {"runs": [{"text": "Revenue"}]},
                            {"runs": [{"text": "$12M"}]},
                        ]
                    ],
                    "min_columns": 1,
                    "max_columns": 2,
                    "min_rows": 1,
                    "max_rows": 1,
                },
                {
                    "type": "chart",
                    "decorative": False,
                    "name": "revenue_chart",
                    "chart_type": "bar",
                    "title": "Revenue",
                    "colors": ["#445566", "#778899"],
                    "x_axis": False,
                    "y_axis": False,
                    "categories": ["Q1", "Q2"],
                    "series": [{"name": "Revenue", "values": [10.0, 12.0]}],
                    "data_labels": "top",
                    "x_axis_grid": True,
                    "y_axis_grid": False,
                },
            ],
        }
    )

    image, table, chart = layout.elements
    assert image.opacity == 0.42
    assert [cell.runs[0].text for cell in table.columns] == ["Metric", "Value"]
    assert chart.colors == ["#445566", "#778899"]
    assert chart.x_axis_grid is True
    assert chart.y_axis_grid is False
    assert chart.series[0].values == [10.0, 12.0]


def test_flow_layout_children_can_omit_geometry():
    layout = RawSlideLayout.model_validate(
        {
            "id": "flow_slide",
            "description": "Layout with flex-computed child geometry.",
            "elements": [
                {
                    "type": "flex",
                    "name": "cards",
                    "direction": "row",
                    "min_children": 1,
                    "max_children": 2,
                    "children": [
                        {
                            "type": "grid",
                            "name": "metric_grid",
                            "columns": 2,
                            "min_children": 1,
                            "max_children": 2,
                            "children": [
                                {
                                    "type": "text",
                                    "decorative": False,
                                    "name": "metric",
                                    "min_length": 2,
                                    "max_length": 4,
                                    "runs": [{"text": "42"}],
                                }
                            ],
                        }
                    ],
                }
            ],
        }
    )

    flex = layout.elements[0]
    grid = flex.children[0]
    assert flex.position is None
    assert grid.size is None
