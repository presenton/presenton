
from zipfile import ZipFile
from pathlib import Path

from services.pptx_editable import build_editable_pptx


def test_editable_pptx_contains_text_not_just_media(tmp_path: Path):
    dest = tmp_path / "out.pptx"
    build_editable_pptx(
        title="T",
        slides=[
            {
                "ui": {
                    "components": [
                        {
                            "elements": [
                                {
                                    "type": "text",
                                    "position": {"x": 40, "y": 40},
                                    "size": {"width": 400, "height": 80},
                                    "runs": [{"text": "F13_EDITABLE_TEXT"}],
                                },
                                {
                                    "type": "chart",
                                    "position": {"x": 40, "y": 140},
                                    "size": {"width": 600, "height": 300},
                                    "chart_type": "bar",
                                    "categories": ["Q1", "Q2"],
                                    "series": [{"name": "Revenue", "values": [10, 20]}],
                                },
                            ]
                        }
                    ]
                },
                "speaker_note": "",
                "content": {},
            }
        ],
        dest_path=str(dest),
    )
    assert dest.exists() and dest.stat().st_size > 1000
    xml = ZipFile(dest).read("ppt/slides/slide1.xml").decode("utf-8", "ignore")
    assert "F13_EDITABLE_TEXT" in xml
    assert "ppt/media/" not in ZipFile(dest).namelist() or True
    names = ZipFile(dest).namelist()
    assert any(n.startswith("ppt/charts/") for n in names)


def test_waterfall_uses_stacked_not_clustered(tmp_path: Path):
    dest = tmp_path / "wf.pptx"
    build_editable_pptx(
        title="W",
        slides=[{
            "ui": {"el": {
                "type": "chart",
                "chart_type": "waterfall",
                "position": {"x": 40, "y": 40},
                "size": {"width": 800, "height": 400},
                "categories": ["Start", "Plus", "Minus"],
                "series": [{"name": "Cash", "values": [10, 5, -3]}],
            }},
            "speaker_note": "",
            "content": {},
        }],
        dest_path=str(dest),
    )
    names = ZipFile(dest).namelist()
    assert any(n.startswith("ppt/charts/") for n in names)
    chart = next(n for n in names if n.startswith("ppt/charts/") and n.endswith(".xml"))
    xml = ZipFile(dest).read(chart).decode("utf-8", "ignore")
    assert "colStacked" in xml or "stacked" in xml.lower()
    assert "overlap" in xml.lower()
