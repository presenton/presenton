import os
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.data_retention_service import get_retention_period_days, run_retention_cleanup


# --- get_retention_period_days ---

def test_returns_none_when_not_set(monkeypatch):
    monkeypatch.delenv("RETENTION_PERIOD_DAYS", raising=False)
    assert get_retention_period_days() is None


def test_returns_none_when_zero(monkeypatch):
    monkeypatch.setenv("RETENTION_PERIOD_DAYS", "0")
    assert get_retention_period_days() is None


def test_returns_days_when_positive(monkeypatch):
    monkeypatch.setenv("RETENTION_PERIOD_DAYS", "7")
    assert get_retention_period_days() == 7


def test_returns_none_on_invalid_value(monkeypatch):
    monkeypatch.setenv("RETENTION_PERIOD_DAYS", "abc")
    assert get_retention_period_days() is None


# --- run_retention_cleanup ---

def _make_presentation(days_old: int, file_paths=None):
    p = MagicMock()
    p.id = uuid.uuid4()
    p.created_at = datetime.now(timezone.utc) - timedelta(days=days_old)
    p.file_paths = file_paths
    return p


@pytest.mark.asyncio
async def test_stale_presentation_is_deleted():
    session = AsyncMock()
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    presentation = _make_presentation(days_old=10)

    # No templates (nothing protected)
    session.exec.side_effect = [
        MagicMock(all=MagicMock(return_value=[])),        # template ids
        MagicMock(all=MagicMock(return_value=[presentation])),  # stale presentations
        MagicMock(),                                       # delete layout codes
        MagicMock(),                                       # delete tasks
    ]

    result = await run_retention_cleanup(session, cutoff)

    session.delete.assert_awaited_once_with(presentation)
    assert result["presentations_deleted"] == 1


@pytest.mark.asyncio
async def test_protected_presentation_is_skipped():
    session = AsyncMock()
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    presentation = _make_presentation(days_old=10)

    # This presentation is a saved template
    session.exec.side_effect = [
        MagicMock(all=MagicMock(return_value=[presentation.id])),  # template ids
        MagicMock(all=MagicMock(return_value=[presentation])),     # stale presentations
        MagicMock(),                                                # delete tasks
    ]

    result = await run_retention_cleanup(session, cutoff)

    session.delete.assert_not_awaited()
    assert result["presentations_deleted"] == 0


@pytest.mark.asyncio
async def test_files_are_deleted_with_presentation(tmp_path):
    session = AsyncMock()
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    test_file = tmp_path / "slide.pptx"
    test_file.write_text("data")

    presentation = _make_presentation(days_old=10, file_paths=[str(test_file)])

    session.exec.side_effect = [
        MagicMock(all=MagicMock(return_value=[])),
        MagicMock(all=MagicMock(return_value=[presentation])),
        MagicMock(),
        MagicMock(),
    ]

    await run_retention_cleanup(session, cutoff)

    assert not test_file.exists()


@pytest.mark.asyncio
async def test_returns_correct_summary():
    session = AsyncMock()
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    session.exec.side_effect = [
        MagicMock(all=MagicMock(return_value=[])),
        MagicMock(all=MagicMock(return_value=[])),
        MagicMock(rowcount=3),
    ]

    result = await run_retention_cleanup(session, cutoff)

    assert result["presentations_deleted"] == 0
    assert "cutoff" in result
