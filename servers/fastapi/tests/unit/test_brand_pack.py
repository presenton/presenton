
import json
import uuid
from pathlib import Path

import pytest
from fastapi import HTTPException

from services.brand_pack import extract_tokens, presentation_theme_from_pack, save_brand_pack


def test_extract_tokens_keeps_colors_only():
    tokens = extract_tokens(
        {
            "name": "Pilot",
            "tokens": {
                "colors": {"primary": "#C41E3A", "background": "#FFF8F0", "card": "#FFFFFF", "stroke": "#222222", "background_text": "#111111", "primary_text": "#FFFFFF"},
                "fonts": {"textFont": {"name": "Manrope", "url": ""}},
            },
        }
    )
    assert tokens["colors"]["primary"] == "#C41E3A"
    assert "title" not in tokens


def test_extract_tokens_rejects_project_metadata():
    with pytest.raises(HTTPException) as exc:
        extract_tokens({"tokens": {"primary": "#000000", "background": "#ffffff", "project": "ALPHA_1999"}})
    assert exc.value.status_code == 422


def test_save_and_theme_shape(tmp_path, monkeypatch):
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(tmp_path))
    pack = save_brand_pack(
        {
            "id": "m894-r1-pilot",
            "name": "M894 R1 Pilot",
            "tokens": {
                "colors": {
                    "primary": "#C41E3A",
                    "background": "#FFF8F0",
                    "card": "#FFFFFF",
                    "stroke": "#1A1A1A",
                    "background_text": "#111111",
                    "primary_text": "#FFFFFF",
                }
            },
        }
    )
    theme = presentation_theme_from_pack(pack)
    assert theme["source"] == "brand-pack"
    assert theme["brand_pack_id"] == "m894-r1-pilot"
    assert theme["data"]["colors"]["primary"] == "#C41E3A"
    assert (tmp_path / "brand_packs" / "m894-r1-pilot.json").exists()
