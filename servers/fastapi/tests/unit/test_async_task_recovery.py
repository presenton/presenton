import asyncio

from enums.async_task_status import AsyncTaskStatus
from models.sql.async_task import AsyncTaskModel
from services.async_tasks import (
    INTERRUPTED_TASK_ERROR,
    fail_interrupted_async_tasks,
)


class _ScalarRows:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows


class _Session:
    def __init__(self, rows):
        self.rows = rows
        self.added = []
        self.commit_count = 0

    async def execute(self, _statement):
        return _ScalarRows(self.rows)

    def add(self, row):
        self.added.append(row)

    async def commit(self):
        self.commit_count += 1


def test_fail_interrupted_async_tasks_prevents_permanent_pending_status():
    task = AsyncTaskModel(
        type="presentation.generate",
        status=AsyncTaskStatus.PENDING,
        message="Generating presentation outlines",
    )
    session = _Session([task])

    count = asyncio.run(fail_interrupted_async_tasks(session))

    assert count == 1
    assert task.status == AsyncTaskStatus.ERROR
    assert task.message == "Background task interrupted by server restart"
    assert task.error == INTERRUPTED_TASK_ERROR
    assert session.added == [task]
    assert session.commit_count == 1


def test_fail_interrupted_async_tasks_does_not_commit_when_none_exist():
    session = _Session([])

    count = asyncio.run(fail_interrupted_async_tasks(session))

    assert count == 0
    assert session.added == []
    assert session.commit_count == 0
