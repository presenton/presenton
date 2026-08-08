import asyncio
import uuid

import pytest
from fastapi import HTTPException

from api.v1.ppt.endpoints.presentation import update_presentation_slide
from models.sql.slide import SlideModel
from tests.conftest import FakeAsyncSession


def _slide(
    *,
    slide_id: uuid.UUID | None = None,
    presentation_id: uuid.UUID | None = None,
    index: int = 0,
    title: str = "Original",
) -> SlideModel:
    return SlideModel(
        id=slide_id or uuid.uuid4(),
        presentation=presentation_id or uuid.uuid4(),
        layout_group="general",
        layout="title",
        index=index,
        content={"title": title},
        properties={"accent": "blue"},
        ui={"components": []},
    )


def test_slide_update_changes_only_mutable_slide_fields():
    stored = _slide(index=2)
    incoming = _slide(
        slide_id=stored.id,
        presentation_id=stored.presentation,
        index=99,
        title="Updated",
    )
    incoming.layout = "content"
    incoming.speaker_note = "Updated note"
    incoming.properties = {"accent": "green"}
    incoming.ui = {"components": [{"id": "hero"}]}
    session = FakeAsyncSession(get_results={stored.id: stored})

    result = asyncio.run(
        update_presentation_slide(slide=incoming, sql_session=session)
    )

    assert result is stored
    assert stored.content == {"title": "Updated"}
    assert stored.layout == "content"
    assert stored.speaker_note == "Updated note"
    assert stored.properties == {"accent": "green"}
    assert stored.ui == {"components": [{"id": "hero"}]}
    assert stored.index == 2
    assert stored.id == incoming.id
    assert stored.presentation == incoming.presentation
    assert session.added == [stored]
    assert session.commit_count == 1


def test_slide_update_coerces_json_uuid_strings_before_database_lookup():
    stored = _slide()
    incoming = _slide(
        slide_id=stored.id,
        presentation_id=stored.presentation,
        title="Updated",
    )
    # SQLModel table models preserve UUIDs as strings when validated from JSON.
    incoming = SlideModel.model_validate_json(incoming.model_dump_json())
    assert isinstance(incoming.id, str)
    assert isinstance(incoming.presentation, str)
    session = FakeAsyncSession(get_results={stored.id: stored})

    result = asyncio.run(
        update_presentation_slide(slide=incoming, sql_session=session)
    )

    assert result is stored
    assert stored.content == {"title": "Updated"}
    assert session.commit_count == 1


def test_slide_update_rejects_invalid_uuid_strings():
    incoming = _slide()
    incoming.id = "not-a-uuid"
    session = FakeAsyncSession()

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            update_presentation_slide(slide=incoming, sql_session=session)
        )

    assert exc_info.value.status_code == 422
    assert session.commit_count == 0


def test_slide_update_rejects_unknown_slide():
    incoming = _slide()
    session = FakeAsyncSession()

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            update_presentation_slide(slide=incoming, sql_session=session)
        )

    assert exc_info.value.status_code == 404
    assert session.commit_count == 0


def test_slide_update_rejects_presentation_mismatch():
    stored = _slide()
    incoming = _slide(slide_id=stored.id, presentation_id=uuid.uuid4())
    session = FakeAsyncSession(get_results={stored.id: stored})

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            update_presentation_slide(slide=incoming, sql_session=session)
        )

    assert exc_info.value.status_code == 400
    assert session.commit_count == 0
