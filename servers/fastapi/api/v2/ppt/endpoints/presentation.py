import json
import logging
import uuid
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.auth.context import (
    get_current_owner_id,
    reset_current_owner_id,
    reset_current_owner_is_admin,
    set_current_owner_id,
    set_current_owner_is_admin,
)
from api.v1.ppt.endpoints.presentation import (
    build_export_cookie_header,
    create_presentation,
    presentation_task_progress_data,
    stream_smart_presentation,
)
from enums.async_task_status import AsyncTaskStatus
from models.api_error_model import APIErrorModel
from models.generate_presentation_request import GenerateSmartPresentationRequest
from models.presentation_and_path import PresentationPathAndEditPath
from models.sql.async_task import AsyncTaskModel
from models.sql.presentation import PresentationModel
from services.database import async_session_maker, get_async_session
from utils.export_utils import export_presentation
from utils.llm_calls.generate_smart_presentation import resolve_smart_slide_count
from utils.mcp_public_urls import absolute_mcp_result_links


PRESENTATION_V2_ROUTER = APIRouter(
    prefix="/presentation",
    tags=["Presentation V2"],
)
ASYNC_TASK_TYPE_SMART_PRESENTATION_GENERATE = "presentation.smart.generate"
LOGGER = logging.getLogger(__name__)


async def _update_smart_task_progress(
    task_id: str,
    *,
    presentation_id: uuid.UUID,
    created_slides: int,
    total_slides: int,
    message: str,
) -> None:
    async with async_session_maker() as progress_session:
        task = await progress_session.get(AsyncTaskModel, task_id)
        if task is None:
            return
        task.message = message
        task.data = presentation_task_progress_data(
            created_slides=created_slides,
            remaining_slides=max(total_slides - created_slides, 0),
            presentation_id=presentation_id,
        )
        task.updated_at = datetime.now()
        progress_session.add(task)
        await progress_session.commit()


async def _create_smart_presentation(
    request: GenerateSmartPresentationRequest,
    sql_session: AsyncSession,
) -> PresentationModel:
    return await create_presentation(
        content=request.content,
        n_slides=request.n_slides,
        language=request.language,
        file_paths=request.files,
        tone=request.tone,
        verbosity=request.verbosity,
        instructions=request.instructions,
        include_table_of_contents=request.include_table_of_contents,
        include_title_slide=request.include_title_slide,
        web_search=request.web_search,
        generation_mode="smart",
        community_design_ids=request.community_design_ids,
        sql_session=sql_session,
    )


async def _generate_and_export_smart_presentation(
    presentation: PresentationModel,
    *,
    export_as: Literal["pptx", "pdf"],
    export_cookie_header: Optional[str],
    sql_session: AsyncSession,
    task_id: str | None = None,
) -> PresentationPathAndEditPath:
    total_slides = resolve_smart_slide_count(presentation.n_slides)
    stream_response = await stream_smart_presentation(presentation, sql_session)
    created_slides = 0
    completed = False
    stream_error: str | None = None

    async for chunk in stream_response.body_iterator:
        text = chunk.decode("utf-8") if isinstance(chunk, bytes) else str(chunk)
        for line in text.splitlines():
            if not line.startswith("data: "):
                continue
            try:
                event = json.loads(line[6:])
            except json.JSONDecodeError:
                continue
            event_type = event.get("type")
            if event_type == "slide_html":
                created_slides = max(
                    created_slides,
                    int(event.get("index", 0)) + 1,
                )
                if task_id:
                    await _update_smart_task_progress(
                        task_id,
                        presentation_id=presentation.id,
                        created_slides=created_slides,
                        total_slides=total_slides,
                        message="Generating Smart presentation slides",
                    )
            elif event_type == "complete":
                completed = True
            elif event_type == "error":
                stream_error = str(event.get("detail") or "Smart generation failed")

    if not completed:
        raise HTTPException(
            status_code=500,
            detail=stream_error or "Smart generation did not complete",
        )

    await sql_session.rollback()
    presentation = await sql_session.get(PresentationModel, presentation.id)
    if presentation is None:
        raise HTTPException(status_code=404, detail="Presentation not found")
    exported = await export_presentation(
        presentation.id,
        presentation.title or str(presentation.id),
        export_as,
        cookie_header=export_cookie_header,
    )
    return PresentationPathAndEditPath(
        presentation_id=presentation.id,
        path=exported.path,
        edit_path=f"/presentation?id={presentation.id}",
    )


async def run_generate_smart_presentation_task(
    task_id: str,
    presentation_id: uuid.UUID,
    export_as: Literal["pptx", "pdf"],
    export_cookie_header: Optional[str],
    owner_id: uuid.UUID | None,
) -> None:
    owner_token = set_current_owner_id(owner_id)
    admin_token = set_current_owner_is_admin(False)
    try:
        async with async_session_maker() as sql_session:
            task = await sql_session.get(AsyncTaskModel, task_id)
            presentation = await sql_session.get(PresentationModel, presentation_id)
            if task is None or presentation is None:
                return

            total_slides = resolve_smart_slide_count(presentation.n_slides)
            await _update_smart_task_progress(
                task_id,
                presentation_id=presentation_id,
                created_slides=0,
                total_slides=total_slides,
                message="Starting Smart presentation generation",
            )
            result = await _generate_and_export_smart_presentation(
                presentation,
                export_as=export_as,
                export_cookie_header=export_cookie_header,
                sql_session=sql_session,
                task_id=task_id,
            )

            task = await sql_session.get(AsyncTaskModel, task_id)
            if task is None:
                return
            task.status = AsyncTaskStatus.COMPLETED
            task.message = "Smart presentation generation completed"
            task.data = {
                **presentation_task_progress_data(
                    created_slides=total_slides,
                    remaining_slides=0,
                    presentation_id=presentation_id,
                ),
                "path": result.path,
                "edit_path": result.edit_path,
                "export_as": export_as,
            }
            task.updated_at = datetime.now()
            sql_session.add(task)
            await sql_session.commit()
    except Exception as exc:
        LOGGER.exception(
            "[presentation.generate.smart.async] generation failed task_id=%s",
            task_id,
        )
        async with async_session_maker() as sql_session:
            task = await sql_session.get(AsyncTaskModel, task_id)
            if task is not None:
                api_error = APIErrorModel.from_exception(
                    exc
                    if isinstance(exc, HTTPException)
                    else HTTPException(
                        status_code=500,
                        detail="Smart presentation generation failed",
                    )
                )
                task.status = AsyncTaskStatus.ERROR
                task.message = "Smart presentation generation failed"
                task.error = api_error.model_dump(mode="json")
                task.updated_at = datetime.now()
                sql_session.add(task)
                await sql_session.commit()
    finally:
        reset_current_owner_is_admin(admin_token)
        reset_current_owner_id(owner_token)


@PRESENTATION_V2_ROUTER.post(
    "/generate/smart",
    response_model=PresentationPathAndEditPath,
    operation_id="generate_smart_presentation",
)
async def generate_smart_presentation_sync(
    request_http: Request,
    request: GenerateSmartPresentationRequest,
    sql_session: AsyncSession = Depends(get_async_session),
):
    """Generate and export a Smart presentation in one blocking request."""
    try:
        presentation = await _create_smart_presentation(request, sql_session)
        response = await _generate_and_export_smart_presentation(
            presentation,
            export_as=request.export_as,
            export_cookie_header=build_export_cookie_header(request_http),
            sql_session=sql_session,
        )
        return response.model_copy(
            update=absolute_mcp_result_links(
                request_http,
                {"path": response.path, "edit_path": response.edit_path},
            )
        )
    except HTTPException:
        raise
    except Exception as exc:
        LOGGER.exception("[presentation.generate.smart] generation failed")
        raise HTTPException(
            status_code=500,
            detail="Smart presentation generation failed",
        ) from exc


@PRESENTATION_V2_ROUTER.post(
    "/generate/smart/async",
    response_model=AsyncTaskModel,
    operation_id="generate_smart_presentation_async",
)
async def generate_smart_presentation_async(
    request_http: Request,
    request: GenerateSmartPresentationRequest,
    background_tasks: BackgroundTasks,
    sql_session: AsyncSession = Depends(get_async_session),
):
    """Queue Smart generation and return a task that can be polled for progress."""
    presentation = await _create_smart_presentation(request, sql_session)
    task = AsyncTaskModel(
        type=ASYNC_TASK_TYPE_SMART_PRESENTATION_GENERATE,
        status=AsyncTaskStatus.PENDING,
        message="Queued for Smart presentation generation",
        data=presentation_task_progress_data(
            created_slides=0,
            remaining_slides=resolve_smart_slide_count(presentation.n_slides),
            presentation_id=presentation.id,
        ),
    )
    sql_session.add(task)
    await sql_session.commit()
    await sql_session.refresh(task)
    background_tasks.add_task(
        run_generate_smart_presentation_task,
        task.id,
        presentation.id,
        request.export_as,
        build_export_cookie_header(request_http),
        get_current_owner_id(),
    )
    return task
