
from services.chart_data import change_chart_type, normalize_chart_data, values_fingerprint

BAR = {
    "type": "chart",
    "chart_type": "bar",
    "categories": ["Q1", "Q2", "Q3"],
    "series": [{"name": "Revenue", "values": [10, 20, 30]}],
    "unit": "млн ₽",
    "period": "2024",
    "source": "finance-snapshot",
}


def test_change_type_keeps_numbers():
    line = change_chart_type(BAR, "line")
    stacked = change_chart_type(BAR, "stacked_bar")
    donut = change_chart_type(BAR, "donut")
    assert values_fingerprint(line) == values_fingerprint(BAR)
    assert values_fingerprint(stacked) == values_fingerprint(BAR)
    assert donut["series"][0]["values"] == [10, 20, 30]
    assert line["chart_type"] == "line"
    assert stacked["chart_type"] == "stacked_bar"


def test_normalize_rejects_non_numeric():
    from fastapi import HTTPException
    import pytest
    with pytest.raises(HTTPException):
        normalize_chart_data({"categories": ["A"], "series": [{"name": "S", "values": ["нет"]}]})


def test_waterfall_keeps_values():
    wf = change_chart_type(BAR, "waterfall")
    assert wf["chart_type"] == "waterfall"
    assert wf["series"][0]["values"] == [10, 20, 30]
