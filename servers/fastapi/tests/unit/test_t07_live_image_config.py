
import json
from pathlib import Path

import asyncio

from utils.image_provider import (
    get_selected_image_provider,
    is_image_generation_disabled,
)
from enums.image_provider import ImageProvider


def test_userconfig_false_wins_over_env_true(monkeypatch, tmp_path: Path):
    cfg = tmp_path / "userConfig.json"
    cfg.write_text(json.dumps({"DISABLE_IMAGE_GENERATION": False, "IMAGE_PROVIDER": "lab-png"}))
    monkeypatch.setenv("USER_CONFIG_PATH", str(cfg))
    monkeypatch.setenv("DISABLE_IMAGE_GENERATION", "true")
    monkeypatch.delenv("IMAGE_PROVIDER", raising=False)
    assert is_image_generation_disabled() is False
    assert get_selected_image_provider() == ImageProvider.LAB_PNG


def test_userconfig_true_disables_even_if_env_false(monkeypatch, tmp_path: Path):
    cfg = tmp_path / "userConfig.json"
    cfg.write_text(json.dumps({"DISABLE_IMAGE_GENERATION": True}))
    monkeypatch.setenv("USER_CONFIG_PATH", str(cfg))
    monkeypatch.setenv("DISABLE_IMAGE_GENERATION", "false")
    assert is_image_generation_disabled() is True


def test_generate_image_lab_png_not_placeholder(monkeypatch, tmp_path: Path):
    cfg = tmp_path / "userConfig.json"
    cfg.write_text(json.dumps({"DISABLE_IMAGE_GENERATION": False, "IMAGE_PROVIDER": "lab-png"}))
    monkeypatch.setenv("USER_CONFIG_PATH", str(cfg))
    monkeypatch.setenv("DISABLE_IMAGE_GENERATION", "true")
    from models.image_prompt import ImagePrompt
    from services.image_generation_service import ImageGenerationService

    out = tmp_path / "images"
    out.mkdir()
    svc = ImageGenerationService(str(out))
    result = asyncio.run(svc.generate_image(ImagePrompt(prompt="t07", theme_prompt="")))
    path = getattr(result, "path", result)
    assert "placeholder" not in str(path)
    assert str(path).endswith(".png")
    assert Path(path).exists()
