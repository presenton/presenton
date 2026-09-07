"""Редакторские проекции слайда: editor-view + editor-ops.

Canvas-редактор Mini App работает не с «сырым» ui-JSON, а с плоским списком
элементов (``GET /presentation/{id}/editor-view``) и набором валидируемых
операций (``PATCH /presentation/{id}/editor-ops``). Семантика операций —
как у чат-инструментов движка (``updateSlide``/``saveSlide``), реализация —
``services/deck_editor_service.py``.

Обе ручки owner-scoped: чужая презентация/слайд уходят в 404 через
owner-скоуп на уровне SQL.
"""

from __future__ import annotations

import copy
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from models.sql.presentation import PresentationModel
from models.sql.slide import SlideModel
from services.database import get_async_session
from services.deck_editor_service import apply_editor_ops, editor_view, ui_is_editable
from utils.datetime_utils import get_current_utc_datetime

PRESENTATION_EDITOR_ROUTER = APIRouter(prefix="/presentation", tags=["Presentation"])


class EditorOpModel(BaseModel):
    op: str
    # не требуется для op=add_element (вставка нового элемента)
    element_path: str | None = None
    # поля, общие для разных операций; валидируются в сервисе по типу op
    position: dict[str, float] | None = None
    size: dict[str, float] | None = None
    text: str | None = None
    patch: dict[str, Any] | None = None
    url: str | None = None
    direction: str | None = None
    # add_element
    type: str | None = None
    rect: dict[str, float] | None = None
    # set_data
    data: dict[str, Any] | None = None
    model_config = {"extra": "forbid"}


class EditorOpsRequest(BaseModel):
    slide_id: uuid.UUID
    ops: list[EditorOpModel] = Field(min_length=1)


class EditorStateRequest(BaseModel):
    """Полная замена ui слайда (undo/redo): клиент хранит снимки ui из
    editor-view/editor-ops и восстанавливает их этим маршрутом."""

    slide_id: uuid.UUID
    ui: dict[str, Any]


async def _presentation_or_404(
    session: AsyncSession, presentation_id: uuid.UUID
) -> PresentationModel:
    presentation = await session.get(PresentationModel, presentation_id)
    if presentation is None:
        raise HTTPException(status_code=404, detail="Presentation not found")
    return presentation


async def _slide_of_presentation_or_404(
    session: AsyncSession,
    presentation_id: uuid.UUID,
    slide_id: uuid.UUID,
) -> SlideModel:
    slide = await session.get(SlideModel, slide_id)
    if slide is None or slide.presentation != presentation_id:
        raise HTTPException(status_code=404, detail="Slide not found")
    return slide


# ---------------------------------------------------------------------------
# GET /presentation/{id}/editor-view?slide_id=...
# ---------------------------------------------------------------------------
@PRESENTATION_EDITOR_ROUTER.get("/{id}/editor-view")
async def get_slide_editor_view(
    id: uuid.UUID,
    slide_id: Annotated[uuid.UUID, Query()],
    sql_session: AsyncSession = Depends(get_async_session),
):
    await _presentation_or_404(sql_session, id)
    slide = await _slide_of_presentation_or_404(sql_session, id, slide_id)
    if not ui_is_editable(slide.ui):
        return {
            "slide_id": str(slide_id),
            "presentation_id": str(id),
            "editable": False,
            "elements": [],
            "width": 1280,
            "height": 720,
        }
    view = editor_view(slide.ui, slide_id=str(slide_id))
    view["presentation_id"] = str(id)
    return view


# ---------------------------------------------------------------------------
# PATCH /presentation/{id}/editor-ops — применить операции к слайду
# ---------------------------------------------------------------------------
@PRESENTATION_EDITOR_ROUTER.patch("/{id}/editor-ops")
async def apply_slide_editor_ops(
    id: uuid.UUID,
    request: EditorOpsRequest,
    sql_session: AsyncSession = Depends(get_async_session),
):
    presentation = await _presentation_or_404(sql_session, id)
    slide = await _slide_of_presentation_or_404(sql_session, id, request.slide_id)
    if not ui_is_editable(slide.ui):
        raise HTTPException(
            status_code=422,
            detail="Slide has no editable ui layout; editor ops are not available",
        )

    try:
        updated_ui = apply_editor_ops(
            copy.deepcopy(slide.ui),
            [raw_op.model_dump(exclude_none=True) for raw_op in request.ops],
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    slide.ui = updated_ui
    sql_session.add(slide)

    presentation.updated_at = get_current_utc_datetime()
    sql_session.add(presentation)
    await sql_session.commit()
    await sql_session.refresh(slide)

    view = editor_view(slide.ui, slide_id=str(slide.id))
    view["presentation_id"] = str(id)
    return view


# ---------------------------------------------------------------------------
# PATCH /presentation/{id}/editor-state — восстановить ui слайда (undo/redo)
# ---------------------------------------------------------------------------
@PRESENTATION_EDITOR_ROUTER.patch("/{id}/editor-state")
async def replace_slide_editor_state(
    id: uuid.UUID,
    request: EditorStateRequest,
    sql_session: AsyncSession = Depends(get_async_session),
):
    presentation = await _presentation_or_404(sql_session, id)
    slide = await _slide_of_presentation_or_404(sql_session, id, request.slide_id)
    if not ui_is_editable(request.ui):
        raise HTTPException(
            status_code=422,
            detail="ui must be a slide layout with a components array",
        )

    slide.ui = copy.deepcopy(request.ui)
    sql_session.add(slide)

    presentation.updated_at = get_current_utc_datetime()
    sql_session.add(presentation)
    await sql_session.commit()
    await sql_session.refresh(slide)

    view = editor_view(slide.ui, slide_id=str(slide.id))
    view["presentation_id"] = str(id)
    return view
