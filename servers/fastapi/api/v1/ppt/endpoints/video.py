import logging
import traceback
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Path, Request
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.auth.config import SESSION_COOKIE_NAME
from api.v1.auth.internal import authenticated_internal_request_headers
from enums.async_task_status import AsyncTaskStatus
from models.presentation_and_path import PresentationAndPath
from models.sql.async_task import AsyncTaskModel
from models.sql.presentation import PresentationModel
from services.database import async_session_maker, get_async_session
from services.video_export_service import VIDEO_EXPORT_SERVICE, VideoExportError

LOGGER = logging.getLogger(__name__)

VIDEO_ROUTER = APIRouter(prefix="/presentation", tags=["Presentation Video"])

ASYNC_TASK_TYPE_PRESENTATION_EXPORT_VIDEO = "presentation.export_video"


def _build_export_cookie_header_from_request(request: Request) -> str | None:
    cookie_header = (request.headers.get("cookie") or "").strip()
    if cookie_header:
        return cookie_header
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if session_token:
        return f"{SESSION_COOKIE_NAME}={session_token}"
    return None


@VIDEO_ROUTER.post("/{id}/export-video", response_model=PresentationAndPath)
async def export_presentation_video_sync(
    request_http: Request,
    id: uuid.UUID = Path(description="ID of the presentation to export as video"),
    sql_session: AsyncSession = Depends(get_async_session),
):
    """
    Synchronously render the presentation's slide notes to narration and
    produce a narrated MP4. Blocks until the video is ready -- suitable for
    short decks or scripted/CLI use. For longer decks, use
    POST /{id}/export-video/async instead and poll
    GET /api/v1/async-tasks/status/{task_id}.
    """
    try:
        cookie_header = _build_export_cookie_header_from_request(
            request_http
        ) or (await authenticated_internal_request_headers()).get("Cookie")
        video_path = await VIDEO_EXPORT_SERVICE.export_presentation_video(
            presentation_id=id,
            sql_session=sql_session,
            cookie_header=cookie_header,
        )
        return PresentationAndPath(presentation_id=id, path=video_path)
    except HTTPException:
        raise
    except VideoExportError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Video export failed")


async def _run_export_video_task(
    presentation_id: uuid.UUID,
    task_id: str,
    cookie_header: str | None,
) -> None:
    async with async_session_maker() as sql_session:
        async_status = await sql_session.get(AsyncTaskModel, task_id)
        if not async_status:
            LOGGER.warning(
                "[video_export.async] task missing task_id=%s", task_id
            )
            return

        async def on_progress(completed: int, total: int, message: str) -> None:
            async_status.status = AsyncTaskStatus.PENDING
            async_status.message = message
            async_status.data = {"completed_slides": completed, "total_slides": total}
            async_status.updated_at = datetime.now()
            sql_session.add(async_status)
            await sql_session.commit()

        try:
            video_path = await VIDEO_EXPORT_SERVICE.export_presentation_video(
                presentation_id=presentation_id,
                sql_session=sql_session,
                on_progress=on_progress,
                cookie_header=cookie_header,
            )
            async_status.status = AsyncTaskStatus.COMPLETED
            async_status.message = "Video export complete"
            async_status.data = {"path": video_path}
        except Exception as exc:
            traceback.print_exc()
            async_status.status = AsyncTaskStatus.ERROR
            async_status.message = "Video export failed"
            async_status.error = {"detail": str(exc)}
        async_status.updated_at = datetime.now()
        sql_session.add(async_status)
        await sql_session.commit()


@VIDEO_ROUTER.post("/{id}/export-video/async", response_model=AsyncTaskModel)
async def export_presentation_video_async(
    request_http: Request,
    background_tasks: BackgroundTasks,
    id: uuid.UUID = Path(description="ID of the presentation to export as video"),
    sql_session: AsyncSession = Depends(get_async_session),
):
    """
    Queue narrated-video export as a background task. Returns an
    AsyncTaskModel immediately; poll GET /api/v1/async-tasks/status/{id}
    (using the returned task id) for progress and the final video path.
    """
    presentation = await sql_session.get(PresentationModel, id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    cookie_header = _build_export_cookie_header_from_request(
        request_http
    ) or (await authenticated_internal_request_headers()).get("Cookie")

    async_status = AsyncTaskModel(
        type=ASYNC_TASK_TYPE_PRESENTATION_EXPORT_VIDEO,
        status=AsyncTaskStatus.PENDING,
        message="Queued for video export",
        data={"completed_slides": 0, "total_slides": 0},
    )
    sql_session.add(async_status)
    await sql_session.commit()
    await sql_session.refresh(async_status)

    background_tasks.add_task(
        _run_export_video_task,
        id,
        async_status.id,
        cookie_header,
    )
    return async_status
