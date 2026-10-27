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


class _PullResponse(_Response):
    def __init__(self, status=200, lines=None):
        super().__init__(status=status, payload={})
        self._lines = lines if lines is not None else [b'{"status":"success"}']

    @property
    def content(self):
        async def _iter():
            for line in self._lines:
                yield line

        return _iter()


class _RecordingClientSession:
    def __init__(self, recorder):
        self._recorder = recorder

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False

    def get(self, url, headers=None, **_kwargs):
        self._recorder.append((url, headers))
        return _Response(payload={"models": []})

    def post(self, url, json=None, headers=None, **_kwargs):
        self._recorder.append((url, headers))
        return _PullResponse()


def _record_requests(monkeypatch, recorder):
    monkeypatch.setattr(
        ollama.aiohttp, "ClientSession", lambda *a, **k: _RecordingClientSession(recorder)
    )


def test_list_models_sends_bearer_token_when_api_key_is_configured(monkeypatch):
    monkeypatch.setenv("OLLAMA_API_KEY", "ollama-secret-key")
    recorder = []
    _record_requests(monkeypatch, recorder)

    asyncio.run(ollama.list_available_ollama_models("http://localhost:11434"))

    assert len(recorder) == 1
    _url, headers = recorder[0]
    assert headers == {"Authorization": "Bearer ollama-secret-key"}


def test_list_models_omits_authorization_header_when_api_key_is_unset(monkeypatch):
    monkeypatch.delenv("OLLAMA_API_KEY", raising=False)
    recorder = []
    _record_requests(monkeypatch, recorder)

    asyncio.run(ollama.list_available_ollama_models("http://localhost:11434"))

    _url, headers = recorder[0]
    assert headers == {}


def test_list_models_omits_authorization_header_when_api_key_is_blank(monkeypatch):
    monkeypatch.setenv("OLLAMA_API_KEY", "   ")
    recorder = []
    _record_requests(monkeypatch, recorder)

    asyncio.run(ollama.list_available_ollama_models("http://localhost:11434"))

    _url, headers = recorder[0]
    assert headers == {}


def test_pull_model_sends_bearer_token_when_api_key_is_configured(monkeypatch):
    monkeypatch.setenv("OLLAMA_API_KEY", "ollama-secret-key")
    recorder = []
    _record_requests(monkeypatch, recorder)

    async def _drain():
        async for _event in ollama.pull_ollama_model("llama3.1:latest"):
            pass

    asyncio.run(_drain())

    assert len(recorder) == 1
    url, headers = recorder[0]
    assert url.endswith("/api/pull")
    assert headers == {"Authorization": "Bearer ollama-secret-key"}


def test_pull_model_omits_authorization_header_when_api_key_is_unset(monkeypatch):
    monkeypatch.delenv("OLLAMA_API_KEY", raising=False)
    recorder = []
    _record_requests(monkeypatch, recorder)

    async def _drain():
        async for _event in ollama.pull_ollama_model("llama3.1:latest"):
            pass

    asyncio.run(_drain())

    _url, headers = recorder[0]
    assert headers == {}


def test_forbidden_response_is_reported_as_configuration_problem(monkeypatch):
    class _ForbiddenClientSession(_RecordingClientSession):
        def get(self, url, headers=None, **_kwargs):
            self._recorder.append((url, headers))
            return _Response(status=403, payload={})

    recorder = []
    monkeypatch.setenv("OLLAMA_API_KEY", "wrong-key")
    monkeypatch.setattr(
        ollama.aiohttp,
        "ClientSession",
        lambda *a, **k: _ForbiddenClientSession(recorder),
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(ollama.list_available_ollama_models("http://localhost:11434"))

    assert exc_info.value.status_code == 403
    assert "check your Ollama Configuration" in exc_info.value.detail
