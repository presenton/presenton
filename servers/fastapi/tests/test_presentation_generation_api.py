import asyncio
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import BackgroundTasks, HTTPException
from pydantic import ValidationError

from api.v1.ppt.endpoints.presentation import (
    _presentation_response_data,
    check_async_presentation_generation_status,
    generate_presentation_async,
    generate_presentation_sync,
)
from models.generate_presentation_request import GeneratePresentationRequest
from models.presentation_and_path import PresentationPathAndEditPath
from models.presentation_with_slides import PresentationWithSlides
from models.sql.async_task import AsyncTaskModel
from models.sql.presentation import PresentationModel, PresentationVersion
from utils.datetime_utils import get_current_utc_datetime


class FakeRequest:
    def __init__(self):
        self.headers: dict[str, str] = {}
        self.cookies: dict[str, str] = {}
        self.state = SimpleNamespace()


class FakeAsyncSession:
    def __init__(self, get_results=None):
        self._get_results = get_results or {}
        self.added = []
        self.commit_count = 0

    async def get(self, *_args, **_kwargs):
        if len(_args) >= 2:
            return self._get_results.get(_args[1])
        return None

    def add(self, obj, *_args, **_kwargs):
        self.added.append(obj)
        return None

    def add_all(self, *_args, **_kwargs):
        return None

    async def commit(self):
        self.commit_count += 1
        return None

    async def refresh(self, *_args, **_kwargs):
        return None


@pytest.mark.parametrize("generation_mode", ["standard", "smart"])
def test_presentation_responses_include_cloud_compatible_type(generation_mode):
    now = get_current_utc_datetime()
    presentation = PresentationModel(
        owner_id=uuid.uuid4(),
        version=PresentationVersion.V2_STANDARD,
        content="Build a deck",
        n_slides=3,
        language="English",
        generation_mode=generation_mode,
        created_at=now,
        updated_at=now,
    )

    response = PresentationWithSlides(
        **_presentation_response_data(presentation),
        slides=[],
    )

    assert response.type == generation_mode
    assert response.model_dump(mode="json")["type"] == generation_mode


class TestPresentationGenerationAPI:
    def test_generate_presentation_export_as_pdf(self):
        request = GeneratePresentationRequest(
            content="Create a presentation about artificial intelligence and machine learning",
            n_slides=5,
            language="English",
            export_as="pdf",
            template="general",
        )
        response_payload = PresentationPathAndEditPath(
            presentation_id=uuid.uuid4(),
            path="/tmp/exports/test.pdf",
            edit_path="/presentation?id=test",
        )
        request_http = FakeRequest()

        with patch(
            "api.v1.ppt.endpoints.presentation.generate_presentation_handler",
            new=AsyncMock(return_value=response_payload),
        ) as mock_handler:
            response = asyncio.run(
                generate_presentation_sync(
                    request_http=request_http,
                    request=request,
                    sql_session=FakeAsyncSession(),
                )
            )

        assert response == response_payload
        mock_handler.assert_awaited_once()
        assert mock_handler.await_args.kwargs["request_http"] is request_http

    def test_generate_presentation_export_as_pptx(self):
        request = GeneratePresentationRequest(
            content="Create a presentation about artificial intelligence and machine learning",
            n_slides=5,
            language="English",
            export_as="pptx",
            template="general",
        )
        response_payload = PresentationPathAndEditPath(
            presentation_id=uuid.uuid4(),
            path="/tmp/exports/test.pptx",
            edit_path="/presentation?id=test",
        )

        with patch(
            "api.v1.ppt.endpoints.presentation.generate_presentation_handler",
            new=AsyncMock(return_value=response_payload),
        ) as mock_handler:
            response = asyncio.run(
                generate_presentation_sync(
                    request_http=FakeRequest(),
                    request=request,
                    sql_session=FakeAsyncSession(),
                )
            )

        assert response == response_payload
        mock_handler.assert_awaited_once()

    def test_generate_presentation_async_enqueues_async_task(self):
        request = GeneratePresentationRequest(
            content="Create a presentation about async task tracking",
            n_slides=5,
            language="English",
            export_as="pptx",
            template="general",
        )
        background_tasks = BackgroundTasks()
        fake_session = FakeAsyncSession()

        task = asyncio.run(
            generate_presentation_async(
                request_http=FakeRequest(),
                request=request,
                background_tasks=background_tasks,
                sql_session=fake_session,
            )
        )

        assert isinstance(task, AsyncTaskModel)
        assert task.type == "presentation.generate"
        assert task.status == "pending"
        assert task.message == "Queued for generation"
        assert task.data["created_slides"] == 0
        assert task.data["remaining_slides"] == 5
        # Present from the moment the task is enqueued, so a polling caller
        # can identify the presentation without waiting for completion.
        assert uuid.UUID(task.data["presentation_id"])
        assert fake_session.added == [task]
        assert fake_session.commit_count == 1
        assert len(background_tasks.tasks) == 1

    def test_presentation_status_reads_async_task(self):
        task = AsyncTaskModel(
            type="presentation.generate",
            status="completed",
            message="Presentation generation completed",
            data={"created_slides": 5, "remaining_slides": 0},
        )
        fake_session = FakeAsyncSession({task.id: task})

        response = asyncio.run(
            check_async_presentation_generation_status(
                id=task.id,
                sql_session=fake_session,
            )
        )

        assert response == task

    def test_generate_presentation_with_no_content(self):
        with pytest.raises(ValidationError):
            GeneratePresentationRequest.model_validate(
                {
                    "n_slides": 5,
                    "language": "English",
                    "export_as": "pdf",
                    "template": "general",
                }
            )

    def test_generate_presentation_with_n_slides_less_than_one(self):
        request = GeneratePresentationRequest(
            content="Create a presentation about artificial intelligence and machine learning",
            n_slides=0,
            language="English",
            export_as="pdf",
            template="general",
        )

        with pytest.raises(HTTPException) as exc:
            asyncio.run(
                generate_presentation_sync(
                    request_http=FakeRequest(),
                    request=request,
                    sql_session=FakeAsyncSession(),
                )
            )

        assert exc.value.status_code == 400
        assert exc.value.detail == "Number of slides must be greater than 0"

    def test_generate_presentation_with_invalid_export_type(self):
        with pytest.raises(ValidationError):
            GeneratePresentationRequest.model_validate(
                {
                    "content": "Create a presentation about artificial intelligence and machine learning",
                    "n_slides": 5,
                    "language": "English",
                    "export_as": "invalid_type",
                    "template": "general",
                }
            )
