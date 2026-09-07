import pytest

from utils.chart_semantics import (
    apply_chart_semantics,
    apply_chart_semantics_to_content,
    coerce_chart_type_for_categories,
    is_temporal_categories,
    is_temporal_category,
)

YEARS = ["2018", "2019", "2020", "2021", "2022"]


@pytest.mark.parametrize(
    "value",
    [
        "2018",
        "2018 г.",
        "2018 год",
        "2024-03",
        "2024-03-15",
        "12.03.2024",
        "03/2024",
        "Q1 2024",
        "q1",
        "1 квартал",
        "март",
        "Марта",
        "январь 2024",
        "12 марта",
        "March 2024",
        "H1 2024",
    ],
)
def test_temporal_category_positive(value):
    assert is_temporal_category(value)


@pytest.mark.parametrize(
    "value",
    ["Север", "Product A", "Q", "Выручка", "24", "12.345", "Итого"],
)
def test_temporal_category_negative(value):
    assert not is_temporal_category(value)


def test_temporal_categories_thresholds():
    assert is_temporal_categories(YEARS)
    assert is_temporal_categories(["Январь", "Февраль", "Март", "Апрель"])
    assert is_temporal_categories(["2018", "2019", "X", "2021"])
    assert not is_temporal_categories(["Север", "Юг", "Запад"])
    assert not is_temporal_categories(["2018", "2019", "X"])
    assert not is_temporal_categories(["2024", "X"])
    assert not is_temporal_categories([])
    assert not is_temporal_categories(None)


def test_coerce_chart_type_for_categories():
    assert coerce_chart_type_for_categories("bar", YEARS) == "line"
    assert coerce_chart_type_for_categories("pie", YEARS) == "line"
    assert coerce_chart_type_for_categories("horizontal_stacked_bar", YEARS) == "line"
    assert coerce_chart_type_for_categories("line", YEARS) is None
    assert coerce_chart_type_for_categories("area", YEARS) is None
    assert coerce_chart_type_for_categories("bar", ["A", "B", "C"]) is None
    assert coerce_chart_type_for_categories(None, YEARS) is None


def test_apply_chart_semantics_mutates_element():
    element = {"type": "chart", "chart_type": "bar", "categories": YEARS, "series": []}
    changes = apply_chart_semantics(element)
    assert element["chart_type"] == "line"
    assert changes and "temporal" in changes[0]


def test_apply_chart_semantics_aliases_and_noop():
    camel = {"chartType": "pie", "labels": ["2020", "2021", "2022", "2023"]}
    assert apply_chart_semantics(camel)
    assert camel["chartType"] == "line"

    plain = {"chart_type": "line", "categories": YEARS}
    assert apply_chart_semantics(plain) == []

    missing = {"categories": YEARS}
    assert apply_chart_semantics(missing) == []


def test_apply_chart_semantics_to_content_walks_nested():
    content = {
        "panel": {
            "type": "chart",
            "chart_type": "bar",
            "categories": YEARS,
            "series": [{"name": "revenue", "values": [1, 2, 3, 4, 5]}],
        },
        "other": {"chart_type": "bar", "categories": ["A", "B", "C"]},
    }
    changes = apply_chart_semantics_to_content(content)
    assert len(changes) == 1
    assert content["panel"]["chart_type"] == "line"
    assert content["other"]["chart_type"] == "bar"
