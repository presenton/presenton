from collections.abc import Iterable
from dataclasses import dataclass
from types import SimpleNamespace
from typing import Any


@dataclass
class FakeStructuredContent:
    payload: dict[str, Any]

    def model_dump(self, mode: str = "json") -> dict[str, Any]:
        return self.payload


def content_event(chunk: str) -> Any:
    return SimpleNamespace(type="content", chunk=chunk)


class FakeLLMClient:
    def __init__(self, events: Iterable[Any]):
        self._events = list(events)
        self.generate_calls: list[dict[str, Any]] = []

    def generate(self, **kwargs: Any):
        self.generate_calls.append(kwargs)
        yield from self._events
