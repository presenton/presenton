import asyncio
from datetime import datetime, timezone
from typing import Any

import pytest
from fastapi import HTTPException
from sqlalchemy import Enum as SQLAlchemyEnum, String
from sqlalchemy.dialects import sqlite

from api.v1.async_tasks.router import (
    API_V1_ASYNC_TASKS_ROUTER,
    check_async_task_status,
    list_async_tasks,
)
from enums.async_task_status import AsyncTaskStatus
from models.sql.async_task import AsyncTaskModel


class _RowsResult:
    def __init__(self, rows: list[Any]):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows


class _FakeAsyncSession:
    def __init__(self, get_results: dict[Any, Any] | None = None):
        self._get_results = get_results or {}
        self.executed_statement = None

    async def get(self, _model: Any, key: Any):
        return self._get_results.get(key)

    async def execute(self, statement: Any):
        self.executed_statement = statement
        return _RowsResult(list(self._get_results.values()))


def test_async_tasks_routes_use_hyphenated_endpoint():
    paths = {route.path for route in API_V1_ASYNC_TASKS_ROUTER.routes}

    assert "/api/v1/async-tasks" in paths
    assert "/api/v1/async-tasks/status/{id}" in paths
    assert "/api/v1/async_tasks" not in paths


def test_async_task_status_enum_uses_string_column():
    assert {status.value for status in AsyncTaskStatus} == {
        "pending",
        "completed",
        "error",
    }

    status_column_type = AsyncTaskModel.__table__.c.status.type
    assert isinstance(status_column_type, String)
    assert not isinstance(status_column_type, SQLAlchemyEnum)


def test_check_async_task_status_returns_task():
    task = AsyncTaskModel(
        type="template.create",
        status="pending",
        message="Queued for template creation",
    )

    response = asyncio.run(
        check_async_task_status(
            id=task.id,
            sql_session=_FakeAsyncSession({task.id: task}),
        )
    )

    assert response == task


def test_check_async_task_status_returns_404_for_missing_task():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            check_async_task_status(
                id="task-missing",
                sql_session=_FakeAsyncSession(),
            )
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == "No async task found"


def test_list_async_tasks_filters_and_orders_tasks():
    task = AsyncTaskModel(
        type="template.create",
        status="completed",
        message="Template creation completed",
    )
    session = _FakeAsyncSession({task.id: task})

    response = asyncio.run(
        list_async_tasks(
            task_type="template.create",
            status="completed",
            created_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
            created_at_from=None,
            created_at_to=datetime(2026, 6, 30, tzinfo=timezone.utc),
            order_by="updated_at",
            order="asc",
            limit=25,
            offset=5,
            sql_session=session,
        )
    )

    assert response == [task]
    compiled = str(
        session.executed_statement.compile(
            dialect=sqlite.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    assert "WHERE async_tasks.type = 'template.create'" in compiled
    assert "async_tasks.status = 'completed'" in compiled
    assert "async_tasks.created_at >= '2026-06-01 00:00:00.000000'" in compiled
    assert "async_tasks.created_at <= '2026-06-30 00:00:00.000000'" in compiled
    assert "ORDER BY async_tasks.updated_at ASC" in compiled
    assert "LIMIT 25 OFFSET 5" in compiled
