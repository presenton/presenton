import asyncio
import base64
import json
import os
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from enums.image_provider import ImageProvider
from models.sql.provider_settings import ProviderSettings
from models.user_config import UserConfig
from services.image_generation_service import ImageGenerationService
from services.provider_settings import merge_provider_settings, migrate_provider_settings_from_file
from utils.get_env import get_gpt_image_2_5_quality_env
from utils.image_provider import get_selected_image_provider
from utils.model_availability import _check_image_provider_configuration
from utils.user_config import get_user_config, update_env_with_user_config
from utils.user_config_store import read_user_config_file

PROVIDERS = ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"]
LEGACY_PROVIDERS = ["gpt-image-1.5", "gpt-image-1.5-2025-12-16"]


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
@pytest.mark.parametrize("provider", PROVIDERS)
@pytest.mark.parametrize("quality", [None, "low", "medium", "high", "xhigh", "max", "auto"])
async def test_both_models_generate_and_save_images(monkeypatch, tmp_path, provider, quality):
    monkeypatch.setenv("IMAGE_PROVIDER", provider)
    monkeypatch.setenv("DISABLE_IMAGE_GENERATION", "false")
    if quality:
        monkeypatch.setenv("GPT_IMAGE_2_5_QUALITY", quality)
    else:
        monkeypatch.delenv("GPT_IMAGE_2_5_QUALITY", raising=False)
    client = SimpleNamespace(images=SimpleNamespace(generate=AsyncMock(
        return_value=SimpleNamespace(data=[SimpleNamespace(
            b64_json=base64.b64encode(b"generated-image").decode()
        )])
    )))
    service = ImageGenerationService(str(tmp_path))

    with patch("services.image_generation_service.AsyncOpenAI", return_value=client):
        output = await service.image_gen_func("landscape", str(tmp_path), (1600, 900))

    client.images.generate.assert_awaited_once_with(
        model=provider, prompt="landscape", n=1,
        quality=quality or "medium", size="1536x1024",
    )
    assert Path(output).read_bytes() == b"generated-image"


@pytest.mark.parametrize("provider", LEGACY_PROVIDERS)
@pytest.mark.parametrize("legacy_quality", [None, "low", "medium", "high"])
def test_saved_gpt_image_1_5_configs_migrate(provider, legacy_quality):
    config = UserConfig(IMAGE_PROVIDER=provider, GPT_IMAGE_1_5_QUALITY=legacy_quality)
    assert config.IMAGE_PROVIDER == "gpt-image-2.5-flare"
    assert config.GPT_IMAGE_2_5_QUALITY == (legacy_quality or "medium")
    assert "GPT_IMAGE_1_5_QUALITY" not in config.model_dump()


def test_migration_preserves_explicit_new_quality():
    config = UserConfig(
        IMAGE_PROVIDER="gpt-image-1.5", GPT_IMAGE_1_5_QUALITY="high",
        GPT_IMAGE_2_5_QUALITY="low",
    )
    assert config.GPT_IMAGE_2_5_QUALITY == "low"


@pytest.mark.parametrize("provider", [*PROVIDERS, "gpt-image-2", "pexels", "pixabay", "gemini_flash"])
def test_migration_preserves_explicit_alternative(provider):
    config = UserConfig(IMAGE_PROVIDER=provider, GPT_IMAGE_1_5_QUALITY="high")
    assert config.IMAGE_PROVIDER == provider
    assert config.GPT_IMAGE_2_5_QUALITY is None


@pytest.mark.parametrize("provider", LEGACY_PROVIDERS)
def test_raw_environment_migrates_provider_and_quality(monkeypatch, provider):
    monkeypatch.setenv("IMAGE_PROVIDER", provider)
    monkeypatch.setenv("GPT_IMAGE_1_5_QUALITY", "high")
    monkeypatch.delenv("GPT_IMAGE_2_5_QUALITY", raising=False)
    assert get_selected_image_provider() == ImageProvider.GPT_IMAGE_2_5_FLARE
    assert get_gpt_image_2_5_quality_env() == "high"
    monkeypatch.setenv("GPT_IMAGE_2_5_QUALITY", "max")
    assert get_gpt_image_2_5_quality_env() == "max"


@pytest.mark.parametrize("provider", PROVIDERS)
def test_both_models_require_openai_key(monkeypatch, provider):
    monkeypatch.setenv("IMAGE_PROVIDER", provider)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(Exception, match="OPENAI_API_KEY must be provided"):
        _check_image_provider_configuration()
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    _check_image_provider_configuration()


@pytest.mark.parametrize("provider", [*PROVIDERS, *LEGACY_PROVIDERS])
def test_config_round_trip_uses_migrated_quality(monkeypatch, tmp_path, provider):
    monkeypatch.setattr(os, "environ", os.environ.copy())
    config_path = tmp_path / "config.json"
    monkeypatch.setenv("USER_CONFIG_PATH", str(config_path))
    monkeypatch.delenv("GPT_IMAGE_2_5_QUALITY", raising=False)
    config_path.write_text(json.dumps({
        "IMAGE_PROVIDER": provider,
        "GPT_IMAGE_1_5_QUALITY": "high",
        **({"GPT_IMAGE_2_5_QUALITY": "max"} if provider in PROVIDERS else {}),
    }))
    update_env_with_user_config()
    config = get_user_config()
    assert config.IMAGE_PROVIDER == (provider if provider in PROVIDERS else "gpt-image-2.5-flare")
    assert config.GPT_IMAGE_2_5_QUALITY == ("max" if provider in PROVIDERS else "high")
    assert os.getenv("GPT_IMAGE_2_5_QUALITY") == config.GPT_IMAGE_2_5_QUALITY


def test_database_startup_migrates_existing_row_and_file(monkeypatch, tmp_path):
    path = tmp_path / "userConfig.json"
    monkeypatch.setenv("USER_CONFIG_PATH", str(path))
    row = ProviderSettings(id=1, config={
        "IMAGE_PROVIDER": "gpt-image-1.5", "GPT_IMAGE_1_5_QUALITY": "high",
        "OPENAI_API_KEY": "test-key", "DISABLE_IMAGE_GENERATION": False,
    })

    class Session:
        commits = 0

        async def get(self, *_args):
            return row

        async def commit(self):
            self.commits += 1

    session = Session()
    config = asyncio.run(migrate_provider_settings_from_file(session))
    assert config == {
        "IMAGE_PROVIDER": "gpt-image-2.5-flare", "GPT_IMAGE_2_5_QUALITY": "high",
        "OPENAI_API_KEY": "test-key", "DISABLE_IMAGE_GENERATION": False,
    }
    assert row.config == config
    assert read_user_config_file(str(path)) == config
    assert session.commits == 1


@pytest.mark.parametrize("incoming, expected_quality", [
    ({"IMAGE_PROVIDER": "gpt-image-1.5"}, "max"),
    ({"IMAGE_PROVIDER": "gpt-image-1.5", "GPT_IMAGE_1_5_QUALITY": "low"}, "max"),
    ({"IMAGE_PROVIDER": "gpt-image-1.5", "GPT_IMAGE_1_5_QUALITY": "high", "GPT_IMAGE_2_5_QUALITY": "low"}, "low"),
])
def test_legacy_settings_patches_preserve_quality_intent(incoming, expected_quality):
    config = merge_provider_settings({
        "IMAGE_PROVIDER": "gpt-image-2.5-sunburst", "GPT_IMAGE_2_5_QUALITY": "max",
    }, incoming)
    assert config["IMAGE_PROVIDER"] == "gpt-image-2.5-flare"
    assert config["GPT_IMAGE_2_5_QUALITY"] == expected_quality
    assert "GPT_IMAGE_1_5_QUALITY" not in config
