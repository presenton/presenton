"""Tests for MiniMax LLM provider integration."""

import os
import sys
import unittest
from unittest.mock import patch

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Check if fastapi is importable (may not be in all test environments)
try:
    from fastapi import HTTPException

    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False


class TestLLMProviderEnum(unittest.TestCase):
    """Test that MINIMAX is a valid LLMProvider enum member."""

    def test_minimax_enum_value(self):
        from enums.llm_provider import LLMProvider

        self.assertEqual(LLMProvider.MINIMAX.value, "minimax")

    def test_minimax_from_string(self):
        from enums.llm_provider import LLMProvider

        self.assertEqual(LLMProvider("minimax"), LLMProvider.MINIMAX)

    def test_invalid_provider_raises(self):
        from enums.llm_provider import LLMProvider

        with self.assertRaises(ValueError):
            LLMProvider("nonexistent")

    def test_all_providers_present(self):
        from enums.llm_provider import LLMProvider

        expected = {"ollama", "openai", "google", "anthropic", "custom", "codex", "minimax"}
        actual = {p.value for p in LLMProvider}
        self.assertEqual(actual, expected)


class TestConstants(unittest.TestCase):
    """Test MiniMax constants."""

    def test_minimax_url(self):
        from constants.llm import MINIMAX_URL

        self.assertEqual(MINIMAX_URL, "https://api.minimax.io/v1")

    def test_default_minimax_model(self):
        from constants.llm import DEFAULT_MINIMAX_MODEL

        self.assertEqual(DEFAULT_MINIMAX_MODEL, "MiniMax-M2.7")

    def test_minimax_url_is_https(self):
        from constants.llm import MINIMAX_URL

        self.assertTrue(MINIMAX_URL.startswith("https://"))


class TestGetEnv(unittest.TestCase):
    """Test MiniMax env variable getters."""

    @patch.dict(os.environ, {"MINIMAX_API_KEY": "test-key-123"})
    def test_get_minimax_api_key(self):
        from utils.get_env import get_minimax_api_key_env

        self.assertEqual(get_minimax_api_key_env(), "test-key-123")

    @patch.dict(os.environ, {"MINIMAX_MODEL": "MiniMax-M2.5"})
    def test_get_minimax_model(self):
        from utils.get_env import get_minimax_model_env

        self.assertEqual(get_minimax_model_env(), "MiniMax-M2.5")

    @patch.dict(os.environ, {}, clear=True)
    def test_get_minimax_api_key_missing(self):
        from utils.get_env import get_minimax_api_key_env

        self.assertIsNone(get_minimax_api_key_env())

    @patch.dict(os.environ, {}, clear=True)
    def test_get_minimax_model_missing(self):
        from utils.get_env import get_minimax_model_env

        self.assertIsNone(get_minimax_model_env())


class TestSetEnv(unittest.TestCase):
    """Test MiniMax env variable setters."""

    def test_set_minimax_api_key(self):
        from utils.set_env import set_minimax_api_key_env

        set_minimax_api_key_env("new-key")
        self.assertEqual(os.environ.get("MINIMAX_API_KEY"), "new-key")
        del os.environ["MINIMAX_API_KEY"]

    def test_set_minimax_model(self):
        from utils.set_env import set_minimax_model_env

        set_minimax_model_env("MiniMax-M2.5-highspeed")
        self.assertEqual(os.environ.get("MINIMAX_MODEL"), "MiniMax-M2.5-highspeed")
        del os.environ["MINIMAX_MODEL"]


class TestUserConfig(unittest.TestCase):
    """Test MiniMax fields in UserConfig model."""

    def test_minimax_fields_default_none(self):
        from models.user_config import UserConfig

        config = UserConfig()
        self.assertIsNone(config.MINIMAX_API_KEY)
        self.assertIsNone(config.MINIMAX_MODEL)

    def test_minimax_fields_set(self):
        from models.user_config import UserConfig

        config = UserConfig(
            MINIMAX_API_KEY="test-key", MINIMAX_MODEL="MiniMax-M2.7"
        )
        self.assertEqual(config.MINIMAX_API_KEY, "test-key")
        self.assertEqual(config.MINIMAX_MODEL, "MiniMax-M2.7")

    def test_minimax_config_with_provider(self):
        from models.user_config import UserConfig

        config = UserConfig(
            LLM="minimax",
            MINIMAX_API_KEY="test-key",
            MINIMAX_MODEL="MiniMax-M2.7",
        )
        self.assertEqual(config.LLM, "minimax")
        self.assertEqual(config.MINIMAX_API_KEY, "test-key")

    def test_minimax_config_serialization(self):
        from models.user_config import UserConfig

        config = UserConfig(
            LLM="minimax",
            MINIMAX_API_KEY="key-abc",
            MINIMAX_MODEL="MiniMax-M2.7",
        )
        data = config.dict()
        self.assertEqual(data["MINIMAX_API_KEY"], "key-abc")
        self.assertEqual(data["MINIMAX_MODEL"], "MiniMax-M2.7")
        self.assertEqual(data["LLM"], "minimax")


@unittest.skipUnless(HAS_FASTAPI, "fastapi not available in test environment")
class TestLLMProviderUtils(unittest.TestCase):
    """Test MiniMax provider detection and model selection."""

    @patch.dict(os.environ, {"LLM": "minimax"})
    def test_is_minimax_selected(self):
        from utils.llm_provider import is_minimax_selected

        self.assertTrue(is_minimax_selected())

    @patch.dict(os.environ, {"LLM": "openai"})
    def test_is_minimax_not_selected(self):
        from utils.llm_provider import is_minimax_selected

        self.assertFalse(is_minimax_selected())

    @patch.dict(os.environ, {"LLM": "minimax", "MINIMAX_MODEL": "MiniMax-M2.5"})
    def test_get_model_minimax_custom(self):
        from utils.llm_provider import get_model

        self.assertEqual(get_model(), "MiniMax-M2.5")

    @patch.dict(os.environ, {"LLM": "minimax"}, clear=False)
    def test_get_model_minimax_default(self):
        os.environ.pop("MINIMAX_MODEL", None)
        from utils.llm_provider import get_model

        self.assertEqual(get_model(), "MiniMax-M2.7")


@unittest.skipUnless(HAS_FASTAPI, "fastapi not available in test environment")
class TestLLMClientMiniMax(unittest.TestCase):
    """Test MiniMax client creation in LLMClient."""

    @patch.dict(os.environ, {"MINIMAX_API_KEY": "test-key-123"})
    def test_get_minimax_client_returns_async_openai(self):
        from services.llm_client import LLMClient

        client = LLMClient()
        minimax_client = client._get_minimax_client()
        self.assertEqual(str(minimax_client.base_url), "https://api.minimax.io/v1/")

    @patch.dict(os.environ, {}, clear=True)
    def test_get_minimax_client_no_key_raises(self):
        from services.llm_client import LLMClient

        os.environ.pop("MINIMAX_API_KEY", None)
        client = LLMClient()
        with self.assertRaises(HTTPException) as ctx:
            client._get_minimax_client()
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("MiniMax API Key", ctx.exception.detail)


@unittest.skipUnless(HAS_FASTAPI, "fastapi not available in test environment")
class TestMiniMaxEndpoint(unittest.TestCase):
    """Test MiniMax API endpoint registration."""

    def test_minimax_router_exists(self):
        from api.v1.ppt.endpoints.minimax import MINIMAX_ROUTER

        self.assertIsNotNone(MINIMAX_ROUTER)
        self.assertEqual(MINIMAX_ROUTER.prefix, "/minimax")

    def test_minimax_router_registered(self):
        from api.v1.ppt.router import API_V1_PPT_ROUTER

        route_paths = [route.path for route in API_V1_PPT_ROUTER.routes]
        minimax_routes = [p for p in route_paths if "minimax" in p]
        self.assertTrue(len(minimax_routes) > 0, "MiniMax routes should be registered")


if __name__ == "__main__":
    unittest.main()
