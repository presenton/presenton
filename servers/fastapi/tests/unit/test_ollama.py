import asyncio

import aiohttp
import pytest
from fastapi import HTTPException

from utils import ollama


class _FailingRequest:
    async def __aenter__(self):
        raise aiohttp.ClientConnectionError("connection refused")

    async def __aexit__(self, *_args):
        return False


class _FailingClientSession:
    def __init__(self, *_args, **_kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False

    def get(self, *_args, **_kwargs):
        return _FailingRequest()


class _Response:
    def __init__(self, status=200, payload=None, text=""):
        self.status = status
        self._payload = payload
        self._text = text
        self.reason = "OK"

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False

    async def json(self, *_args, **_kwargs):
        return self._payload

    async def text(self):
        return self._text


class _BadPayloadClientSession:
    def __init__(self, *_args, **_kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False

    def get(self, *_args, **_kwargs):
        return _Response(payload={"unexpected": []})


def test_list_models_returns_service_unavailable_when_ollama_is_unreachable(
    monkeypatch,
):
    monkeypatch.setenv("OLLAMA_URL", "http://host.docker.internal:11434/")
    monkeypatch.setattr(ollama.aiohttp, "ClientSession", _FailingClientSession)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(ollama.list_available_ollama_models("http://ollama.example:11434/"))

    assert exc_info.value.status_code == 503
    assert "http://ollama.example:11434" in exc_info.value.detail
    assert "instead of localhost" in exc_info.value.detail


def test_list_models_rejects_invalid_ollama_url():
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(ollama.list_available_ollama_models("http://local\thost:11434"))

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid Ollama URL"


def test_list_models_rejects_invalid_ollama_payload(monkeypatch):
    monkeypatch.setattr(ollama.aiohttp, "ClientSession", _BadPayloadClientSession)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(ollama.list_available_ollama_models("http://localhost:11434"))

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == "Ollama returned an invalid models response"
