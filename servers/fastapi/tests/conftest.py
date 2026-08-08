import json
from pathlib import Path
from typing import Any

import pytest


class FakeAsyncSession:
    def __init__(self, get_results: dict[Any, Any] | None = None):
        self._get_results = get_results or {}
        self.added: list[Any] = []
        self.added_all: list[Any] = []
        self.deleted: list[Any] = []
        self.commit_count = 0

    async def get(self, _model: Any, key: Any):
        return self._get_results.get(key)

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    def add_all(self, objs: list[Any]) -> None:
        self.added_all.extend(list(objs))

    async def delete(self, obj: Any) -> None:
        self.deleted.append(obj)

    async def commit(self) -> None:
        self.commit_count += 1

    async def rollback(self) -> None:
        return None

    async def refresh(self, _obj: Any) -> None:
        return None

    async def execute(self, *_args: Any, **_kwargs: Any):
        class _EmptyResult:
            def scalars(self):
                return self

            def all(self):
                return []

            def __iter__(self):
                return iter([])

        return _EmptyResult()

    async def scalars(self, *_args: Any, **_kwargs: Any):
        return []


@pytest.fixture
def fake_async_session() -> FakeAsyncSession:
    return FakeAsyncSession()


@pytest.fixture
def snapshots_dir() -> Path:
    return Path(__file__).parent / "regression" / "snapshots"


@pytest.fixture
def load_snapshot(snapshots_dir: Path):
    def _load(name: str) -> dict[str, Any]:
        path = snapshots_dir / name
        return json.loads(path.read_text(encoding="utf-8"))

    return _load
