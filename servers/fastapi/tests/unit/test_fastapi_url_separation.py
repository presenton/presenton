"""Tests for FAST_API_INTERNAL_URL / NEXT_PUBLIC_FAST_API separation.

In Docker deployments, NEXT_PUBLIC_FAST_API must NOT be set by the server so
that browser-facing asset URLs stay path-only (/app_data/images/...) instead of
absolute http://127.0.0.1:8000/... URLs that browsers cannot reach.

FAST_API_INTERNAL_URL is used for service-to-service calls inside the container.
"""

import os
import pytest
from unittest.mock import patch

from utils.get_env import get_fastapi_internal_url, get_fastapi_public_base_url
from utils.asset_directory_utils import absolute_fastapi_asset_url


class TestGetFastapiInternalUrl:
    """Tests for get_fastapi_internal_url()."""

    def test_returns_fast_api_internal_url_when_set(self, monkeypatch):
        monkeypatch.setenv("FAST_API_INTERNAL_URL", "http://127.0.0.1:8000")
        monkeypatch.delenv("NEXT_PUBLIC_FAST_API", raising=False)
        assert get_fastapi_internal_url() == "http://127.0.0.1:8000"

    def test_falls_back_to_next_public_fast_api(self, monkeypatch):
        monkeypatch.delenv("FAST_API_INTERNAL_URL", raising=False)
        monkeypatch.setenv("NEXT_PUBLIC_FAST_API", "http://localhost:5000")
        assert get_fastapi_internal_url() == "http://localhost:5000"

    def test_prefers_fast_api_internal_url_over_next_public(self, monkeypatch):
        monkeypatch.setenv("FAST_API_INTERNAL_URL", "http://127.0.0.1:8000")
        monkeypatch.setenv("NEXT_PUBLIC_FAST_API", "http://localhost:5000")
        assert get_fastapi_internal_url() == "http://127.0.0.1:8000"

    def test_returns_none_when_neither_set(self, monkeypatch):
        monkeypatch.delenv("FAST_API_INTERNAL_URL", raising=False)
        monkeypatch.delenv("NEXT_PUBLIC_FAST_API", raising=False)
        assert get_fastapi_internal_url() is None

    def test_strips_trailing_slash(self, monkeypatch):
        monkeypatch.setenv("FAST_API_INTERNAL_URL", "http://127.0.0.1:8000/")
        assert get_fastapi_internal_url() == "http://127.0.0.1:8000"

    def test_strips_whitespace(self, monkeypatch):
        monkeypatch.setenv("FAST_API_INTERNAL_URL", "  http://127.0.0.1:8000  ")
        assert get_fastapi_internal_url() == "http://127.0.0.1:8000"


class TestGetFastapiPublicBaseUrl:
    """Tests for get_fastapi_public_base_url()."""

    def test_returns_none_when_not_set(self, monkeypatch):
        monkeypatch.delenv("NEXT_PUBLIC_FAST_API", raising=False)
        assert get_fastapi_public_base_url() is None

    def test_returns_value_when_set(self, monkeypatch):
        monkeypatch.setenv("NEXT_PUBLIC_FAST_API", "http://localhost:5000")
        assert get_fastapi_public_base_url() == "http://localhost:5000"

    def test_strips_trailing_slash(self, monkeypatch):
        monkeypatch.setenv("NEXT_PUBLIC_FAST_API", "http://localhost:5000/")
        assert get_fastapi_public_base_url() == "http://localhost:5000"


class TestDockerImageUrls:
    """Tests verifying Docker scenario: path-only asset URLs when NEXT_PUBLIC_FAST_API is unset."""

    def test_docker_images_are_path_only(self, monkeypatch):
        """In Docker, NEXT_PUBLIC_FAST_API is not set, so asset URLs should be path-only."""
        monkeypatch.delenv("NEXT_PUBLIC_FAST_API", raising=False)
        result = absolute_fastapi_asset_url("/app_data/images/test.png")
        assert result == "/app_data/images/test.png"

    def test_docker_static_assets_are_path_only(self, monkeypatch):
        monkeypatch.delenv("NEXT_PUBLIC_FAST_API", raising=False)
        result = absolute_fastapi_asset_url("/static/images/placeholder.jpg")
        assert result == "/static/images/placeholder.jpg"

    def test_electron_images_are_absolute(self, monkeypatch):
        """In Electron, NEXT_PUBLIC_FAST_API is set, so asset URLs should be absolute."""
        monkeypatch.setenv("NEXT_PUBLIC_FAST_API", "http://localhost:5000")
        result = absolute_fastapi_asset_url("/app_data/images/test.png")
        assert result == "http://localhost:5000/app_data/images/test.png"

    def test_docker_internal_url_is_set(self, monkeypatch):
        """In Docker, FAST_API_INTERNAL_URL is set for service-to-service calls."""
        monkeypatch.setenv("FAST_API_INTERNAL_URL", "http://127.0.0.1:8000")
        monkeypatch.delenv("NEXT_PUBLIC_FAST_API", raising=False)
        # Internal URL is available for service calls
        assert get_fastapi_internal_url() == "http://127.0.0.1:8000"
        # But public URL is None, so asset URLs are path-only
        assert get_fastapi_public_base_url() is None
        assert absolute_fastapi_asset_url("/app_data/images/test.png") == "/app_data/images/test.png"

    def test_misconfigured_docker_public_loopback_still_returns_absolute_url(self, monkeypatch):
        """Regression coverage for Unraid-style env misconfiguration.

        If NEXT_PUBLIC_FAST_API is explicitly set to loopback in Docker,
        browser-facing image URLs remain absolute to 127.0.0.1 and are unreachable
        from remote clients.
        """
        monkeypatch.setenv("NEXT_PUBLIC_FAST_API", "http://127.0.0.1:8000")
        result = absolute_fastapi_asset_url("/app_data/images/test.png")
        assert result == "http://127.0.0.1:8000/app_data/images/test.png"

    def test_http_urls_passed_through(self, monkeypatch):
        """Absolute HTTP URLs should be passed through unchanged."""
        monkeypatch.delenv("NEXT_PUBLIC_FAST_API", raising=False)
        result = absolute_fastapi_asset_url("https://images.pexels.com/photo.jpg")
        assert result == "https://images.pexels.com/photo.jpg"