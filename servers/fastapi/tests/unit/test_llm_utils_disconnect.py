import asyncio
import threading
import time
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from llmai.shared import ResponseStreamCompletionChunk, ResponseStreamContentChunk

from utils.llm_utils import generate_structured_with_schema_retries


class RetryClient:
    def __init__(self):
        self.calls = []
        self.responses = [None, {"result": "ok"}]

    def generate(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(content=self.responses.pop(0))


class StreamingClient:
    def __init__(self):
        self.calls = []
        self.started = threading.Event()
        self.closed = threading.Event()

    def generate(self, **kwargs):
        self.calls.append(kwargs)

        def events():
            try:
                while True:
                    self.started.set()
                    time.sleep(0.01)
                    yield ResponseStreamContentChunk(chunk='{"result":"pending"}')
            finally:
                self.closed.set()

        return events()


def test_regular_generation_keeps_existing_retry_behavior(monkeypatch):
    monkeypatch.setenv("LLM", "ollama")
    client = RetryClient()

    with patch("utils.llm_utils.asyncio.sleep", new=AsyncMock()):
        result = asyncio.run(
            generate_structured_with_schema_retries(
                client,
                "test-model",
                messages=[],
                response_format=object(),
                json_schema={},
            )
        )

    assert result == {"result": "ok"}
    assert len(client.calls) == 2
    assert all(call["stream"] is False for call in client.calls)


def test_disconnect_cancels_generation_without_retrying(monkeypatch):
    monkeypatch.setenv("LLM", "ollama")
    client = StreamingClient()

    async def run():
        async def is_disconnected():
            return client.started.is_set()

        with pytest.raises(asyncio.CancelledError):
            await generate_structured_with_schema_retries(
                client,
                "test-model",
                messages=[],
                response_format=object(),
                json_schema={},
                disconnect_checker=is_disconnected,
            )

        while not client.closed.is_set():
            await asyncio.sleep(0.001)

    asyncio.run(run())

    assert len(client.calls) == 1
    assert client.calls[0]["stream"] is True


def test_connected_request_uses_stream_completion_content(monkeypatch):
    monkeypatch.setenv("LLM", "ollama")

    class CompletedClient:
        def __init__(self):
            self.calls = []

        def generate(self, **kwargs):
            self.calls.append(kwargs)
            return iter(
                [
                    ResponseStreamCompletionChunk(
                        content={"result": "complete"}
                    )
                ]
            )

    client = CompletedClient()

    async def run():
        async def is_disconnected():
            return False

        return await generate_structured_with_schema_retries(
            client,
            "test-model",
            messages=[],
            response_format=object(),
            json_schema={},
            disconnect_checker=is_disconnected,
        )

    assert asyncio.run(run()) == {"result": "complete"}
    assert client.calls[0]["stream"] is True


def test_connected_request_keeps_schema_validation_retries(monkeypatch):
    monkeypatch.setenv("LLM", "ollama")

    class ValidationRetryClient:
        def __init__(self):
            self.calls = []
            self.responses = [{"wrong": "value"}, {"result": "fixed"}]

        def generate(self, **kwargs):
            self.calls.append(kwargs)
            return iter(
                [ResponseStreamCompletionChunk(content=self.responses.pop(0))]
            )

    client = ValidationRetryClient()

    async def run():
        async def is_disconnected():
            return False

        return await generate_structured_with_schema_retries(
            client,
            "test-model",
            messages=[],
            response_format=object(),
            json_schema={
                "type": "object",
                "properties": {"result": {"type": "string"}},
                "required": ["result"],
            },
            validate_schema=True,
            disconnect_checker=is_disconnected,
        )

    assert asyncio.run(run()) == {"result": "fixed"}
    assert len(client.calls) == 2
    assert all(call["stream"] is True for call in client.calls)
