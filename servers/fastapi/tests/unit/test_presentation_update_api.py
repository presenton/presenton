import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.v1.ppt.endpoints.presentation import (
    PRESENTATION_ROUTER,
    UpdatePresentationRequest,
    update_presentation,
)
from models.sql.presentation import PresentationModel, PresentationVersion
from services.database import get_async_session
from tests.conftest import FakeAsyncSession


def _presentation(**overrides) -> PresentationModel:
    now = datetime.now(timezone.utc)
    values = {
        "id": uuid.uuid4(),
        "version": PresentationVersion.V1_STANDARD,
        "content": "",
        "n_slides": 2,
        "language": "en",
        "title": "Original",
        "theme": {"primary": "#123456"},
        "created_at": now,
        "updated_at": now,
    }
    values.update(overrides)
    return PresentationModel(**values)


def _client(session: FakeAsyncSession) -> TestClient:
    app = FastAPI()
    app.include_router(PRESENTATION_ROUTER)
    app.dependency_overrides[get_async_session] = lambda: session
    return TestClient(app)


def test_title_only_update_keeps_theme():
    presentation = _presentation()
    session = FakeAsyncSession(get_results={presentation.id: presentation})

    asyncio.run(
        update_presentation(
            request=UpdatePresentationRequest(id=presentation.id, title="Renamed"),
            sql_session=session,
        )
    )

    assert presentation.title == "Renamed"
    assert presentation.theme == {"primary": "#123456"}


def test_patch_without_theme_key_keeps_stored_theme():
    presentation = _presentation()
    session = FakeAsyncSession(get_results={presentation.id: presentation})

    response = _client(session).patch(
        "/presentation/update",
        json={"id": str(presentation.id), "title": "Renamed"},
    )

    assert response.status_code == 200
    assert presentation.title == "Renamed"
    assert presentation.theme == {"primary": "#123456"}


def test_patch_with_explicit_null_theme_clears_theme():
    presentation = _presentation()
    session = FakeAsyncSession(get_results={presentation.id: presentation})

    response = _client(session).patch(
        "/presentation/update",
        json={"id": str(presentation.id), "theme": None},
    )

    assert response.status_code == 200
    assert presentation.theme is None


def test_patch_with_new_theme_updates_theme():
    presentation = _presentation()
    session = FakeAsyncSession(get_results={presentation.id: presentation})

    response = _client(session).patch(
        "/presentation/update",
        json={"id": str(presentation.id), "theme": {"primary": "#abcdef"}},
    )

    assert response.status_code == 200
    assert presentation.theme == {"primary": "#abcdef"}
