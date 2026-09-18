
from pathlib import Path

from services.tabular_source import extract_tabular_source, parse_a1_range


def test_parse_a1_range():
    assert parse_a1_range("B2:D4") == (2, 2, 4, 4)


def test_csv_range_keeps_numbers(tmp_path: Path):
    path = tmp_path / "kpi.csv"
    path.write_text("q,rev,note\nQ1,10,ok\nQ2,20,ok\nQ3,30,ok\n", encoding="utf-8")
    table = extract_tabular_source(str(path), a1="A1:B3")
    assert table["columns"] == ["q", "rev"]
    assert table["rows"] == [["Q1", 10], ["Q2", 20]]
    assert table["engine"] == "csv"
    assert table["rows"][0][1] == 10


def test_csv_missing_cells_warned(tmp_path: Path):
    path = tmp_path / "short.csv"
    path.write_text("a,b\n1\n", encoding="utf-8")
    table = extract_tabular_source(str(path), a1="A1:B3")
    assert table["rows"][-1] == [None, None]
    assert table["warnings"]
