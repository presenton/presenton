import asyncio
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import BackgroundTasks, HTTPException
from pydantic import ValidationError

from api.main import app
from api.v1.ppt.endpoints.presentation import (
    _presentation_response_data,
    check_async_presentation_generation_status,
    generate_presentation_async,
    generate_presentation_sync,
)
from api.v2.ppt.endpoints.presentation import (
    generate_smart_presentation_sync,
    generate_smart_presentation_async,
    run_generate_smart_presentation_task,
)
from models.generate_presentation_request import (
    GeneratePresentationRequest,
    GenerateSmartPresentationRequest,
)
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

    async def rollback(self):
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
    def test_smart_async_generation_is_versioned_under_v2(self):
        paths = app.openapi()["paths"]

        assert "/api/v2/ppt/presentation/generate/smart" in paths
        assert "/api/v2/ppt/presentation/generate/smart/async" in paths
        assert "/api/v1/ppt/presentation/generate/smart/async" not in paths

    def test_generate_smart_presentation_sync_returns_export_directly(self):
        request = GenerateSmartPresentationRequest(
            content="Create a smart presentation",
            n_slides=3,
            export_as="pdf",
        )
        presentation = PresentationModel(
            id=uuid.uuid4(),
            version=PresentationVersion.V2_STANDARD,
            content=request.content,
            n_slides=3,
            language="",
            generation_mode="smart",
        )
        expected = PresentationPathAndEditPath(
            presentation_id=presentation.id,
            path="/exports/smart.pdf",
            edit_path=f"/presentation?id={presentation.id}",
        )

        with patch(
            "api.v2.ppt.endpoints.presentation._create_smart_presentation",
            new=AsyncMock(return_value=presentation),
        ), patch(
            "api.v2.ppt.endpoints.presentation._generate_and_export_smart_presentation",
            new=AsyncMock(return_value=expected),
        ) as generate_mock:
            response = asyncio.run(
                generate_smart_presentation_sync(
                    request_http=FakeRequest(),
                    request=request,
                    sql_session=FakeAsyncSession(),
                )
            )

        assert response == expected
        assert generate_mock.await_args.kwargs["export_as"] == "pdf"
        assert "task_id" not in generate_mock.await_args.kwargs

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

    def test_generate_smart_presentation_async_uses_existing_background_flow(self):
        request = GenerateSmartPresentationRequest(
            content="Create a smart async presentation",
            n_slides=4,
            export_as="pptx",
        )
        background_tasks = BackgroundTasks()
        fake_session = FakeAsyncSession()
        presentation = PresentationModel(
            id=uuid.uuid4(),
            version=PresentationVersion.V2_STANDARD,
            content=request.content,
            n_slides=4,
            language="",
            generation_mode="smart",
        )

        with patch(
            "api.v2.ppt.endpoints.presentation.create_presentation",
            new=AsyncMock(return_value=presentation),
        ) as create_mock:
            task = asyncio.run(
                generate_smart_presentation_async(
                    request_http=FakeRequest(),
                    request=request,
                    background_tasks=background_tasks,
                    sql_session=fake_session,
                )
            )

        assert task.type == "presentation.smart.generate"
        assert task.status == "pending"
        assert task.data == {
            "created_slides": 0,
            "remaining_slides": 4,
            "presentation_id": str(presentation.id),
        }
        assert fake_session.added == [task]
        assert fake_session.commit_count == 1
        assert len(background_tasks.tasks) == 1
        create_mock.assert_awaited_once()

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
                request=FakeRequest(),
                id=task.id,
                sql_session=fake_session,
            )
        )

        assert response == task

    def test_smart_background_task_completes_and_exports(self):
        presentation = PresentationModel(
            id=uuid.uuid4(),
            version=PresentationVersion.V2_STANDARD,
            content="Smart deck",
            n_slides=1,
            language="",
            title="Smart deck",
            generation_mode="smart",
        )
        task = AsyncTaskModel(
            type="presentation.smart.generate",
            status="pending",
            data={"presentation_id": str(presentation.id)},
        )
        fake_session = FakeAsyncSession(
            {task.id: task, presentation.id: presentation}
        )

        class SessionContext:
            async def __aenter__(self):
                return fake_session

            async def __aexit__(self, *_args):
                return None

        async def body_iterator():
            yield 'data: {"type":"slide_html","index":0}\n\n'
            yield 'data: {"type":"complete","presentation":{}}\n\n'

        with patch(
            "api.v2.ppt.endpoints.presentation.async_session_maker",
            new=lambda: SessionContext(),
        ), patch(
            "api.v2.ppt.endpoints.presentation.stream_smart_presentation",
            new=AsyncMock(
                return_value=SimpleNamespace(body_iterator=body_iterator())
            ),
        ), patch(
            "api.v2.ppt.endpoints.presentation.export_presentation",
            new=AsyncMock(return_value=SimpleNamespace(path="/exports/smart.pptx")),
        ):
            asyncio.run(
                run_generate_smart_presentation_task(
                    task.id,
                    presentation.id,
                    "pptx",
                    None,
                    None,
                )
            )

        assert task.status == "completed"
        assert task.data["path"] == "/exports/smart.pptx"
        assert task.data["edit_path"] == f"/presentation?id={presentation.id}"

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
