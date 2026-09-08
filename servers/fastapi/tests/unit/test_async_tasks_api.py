import asyncio
import warnings
from datetime import datetime, timezone
from typing import Any

import pytest
from fastapi import HTTPException, Request
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


def _request(*, mcp: bool = False) -> Request:
    headers = [(b"host", b"presenton.example.com")]
    if mcp:
        headers.extend(
            [
                (b"x-presenton-mcp-request", b"1"),
                (b"x-forwarded-proto", b"https"),
            ]
        )
    return Request(
        {
            "type": "http",
            "method": "GET",
            "scheme": "http",
            "server": ("127.0.0.1", 8000),
            "path": "/api/v1/async-tasks/status/task-id",
            "headers": headers,
        }
    )


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


@pytest.mark.parametrize("status", [AsyncTaskStatus.PENDING, "pending"])
def test_async_task_status_serializes_without_pydantic_warnings(status):
    task = AsyncTaskModel(
        type="template.create",
        status=status,
        payload={"private": "generation-input"},
    )

    with warnings.catch_warnings():
        warnings.simplefilter("error")
        payload = task.model_dump_json()

    assert '"status":"pending"' in payload
    assert "generation-input" not in payload


def test_check_async_task_status_returns_task():
    task = AsyncTaskModel(
        type="template.create",
        status="pending",
        message="Queued for template creation",
    )

    response = asyncio.run(
        check_async_task_status(
            request=_request(),
            id=task.id,
            sql_session=_FakeAsyncSession({task.id: task}),
        )
    )

    assert response == task.model_dump(mode="python")


def test_check_async_task_status_returns_404_for_missing_task():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            check_async_task_status(
                request=_request(),
                id="task-missing",
                sql_session=_FakeAsyncSession(),
            )
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == "No async task found"


def test_check_async_task_status_qualifies_mcp_result_links(monkeypatch):
    monkeypatch.delenv("PRESENTON_PUBLIC_URL", raising=False)
    task = AsyncTaskModel(
        type="presentation.generate",
        status="completed",
        data={
            "path": "/app_data/exports/deck.pptx",
            "edit_path": "/presentation?id=deck-id",
        },
    )

    response = asyncio.run(
        check_async_task_status(
            request=_request(mcp=True),
            id=task.id,
            sql_session=_FakeAsyncSession({task.id: task}),
        )
    )

    assert response["data"] == {
        "path": "https://presenton.example.com/app_data/exports/deck.pptx",
        "edit_path": "https://presenton.example.com/presentation?id=deck-id",
    }
    assert task.data["path"] == "/app_data/exports/deck.pptx"


def test_check_async_task_status_uses_configured_public_url(monkeypatch):
    monkeypatch.setenv("PRESENTON_PUBLIC_URL", "https://slides.example.com/root/")
    task = AsyncTaskModel(
        type="presentation.generate",
        status="completed",
        data={"path": "/app_data/exports/deck.pptx"},
    )

    response = asyncio.run(
        check_async_task_status(
            request=_request(mcp=True),
            id=task.id,
            sql_session=_FakeAsyncSession({task.id: task}),
        )
    )

    assert response["data"]["path"] == (
        "https://slides.example.com/root/app_data/exports/deck.pptx"
    )


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
