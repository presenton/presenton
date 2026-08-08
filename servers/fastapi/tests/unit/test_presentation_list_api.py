import asyncio
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.dialects import sqlite

from api.v1.ppt.endpoints import presentation as presentation_endpoint
from models.sql.presentation import PresentationModel, PresentationVersion


class _RowsResult:
    def __init__(self, values=None):
        self.values = values or []

    def all(self):
        return self.values

    def scalars(self):
        return self


class _CapturingAsyncSession:
    def __init__(self, values=None):
        self.executed_statement: Any = None
        self.values = values or []

    async def execute(self, statement: Any):
        self.executed_statement = statement
        return _RowsResult(self.values)


def _compile_statement(statement: Any) -> str:
    return str(
        statement.compile(
            dialect=sqlite.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )


def test_get_all_presentations_filters_by_version():
    session = _CapturingAsyncSession()

    response = asyncio.run(
        presentation_endpoint.get_all_presentations(
            version=PresentationVersion.V2_STANDARD,
            sql_session=session,
        )
    )

    assert response == []
    compiled = _compile_statement(session.executed_statement)
    assert "WHERE presentations.version = 'v2-standard'" in compiled
    assert "ORDER BY presentations.created_at DESC" in compiled


def test_get_all_presentations_omits_version_filter_by_default():
    session = _CapturingAsyncSession()

    response = asyncio.run(
        presentation_endpoint.get_all_presentations(
            sql_session=session,
        )
    )

    assert response == []
    compiled = _compile_statement(session.executed_statement)
    assert "presentations.version =" not in compiled
    assert "ORDER BY presentations.created_at DESC" in compiled


def test_get_all_presentations_can_skip_slide_preview_join():
    now = datetime.now(timezone.utc)
    legacy_presentation = PresentationModel(
        version=PresentationVersion.V1_STANDARD,
        content="Legacy deck",
        n_slides=4,
        language="en",
        title="Older presentation",
        fonts={"Inter": "https://example.com/inter.css"},
        created_at=now,
        updated_at=now,
    )
    session = _CapturingAsyncSession([legacy_presentation])

    response = asyncio.run(
        presentation_endpoint.get_all_presentations(
            version=PresentationVersion.V1_STANDARD,
            include_slides=False,
            sql_session=session,
        )
    )

    assert len(response) == 1
    assert response[0].id == legacy_presentation.id
    assert response[0].version == PresentationVersion.V1_STANDARD
    assert response[0].slides == []
    assert response[0].fonts == {"Inter": "https://example.com/inter.css"}
    compiled = _compile_statement(session.executed_statement)
    assert "WHERE presentations.version = 'v1-standard'" in compiled
    assert "JOIN slides" not in compiled
    assert "ORDER BY presentations.created_at DESC" in compiled
