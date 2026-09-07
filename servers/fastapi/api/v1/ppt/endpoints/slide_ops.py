"""Слайд-операции: дубликат/удаление/добавление/порядок/каталог заготовок.

Mini App управляет структурой деки через эти эндпоинты вместо «полной замены
набора слайдов» (PATCH /presentation/update), которая пересоздаёт все строки и
не подходит для точечных правок с телефона. Все маршруты — под cookie-сессией,
изоляция владельца обеспечивается owner-скоупом на уровне SQL.

Заготовки: презентация хранит шаблонный payload в ``presentation.layout``
(``{"layouts": [...]}``), из него берутся id + description layout'ов для
каталога, а сам ui слайда копируется тем же путём, что и при генерации
(``_template_slide_ui``).
"""

from __future__ import annotations

import copy
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.ppt.endpoints.presentation import (
    BLANK_PRESENTATION_LAYOUT_GROUP,
    BLANK_PRESENTATION_LAYOUT_ID,
    _blank_presentation_slide_ui,
    _is_template_layout_payload,
    _template_slide_ui,
)
from constants.presentation import MAX_NUMBER_OF_SLIDES
from models.sql.presentation import PresentationModel
from models.sql.slide import SlideModel
from services.database import get_async_session
from utils.datetime_utils import get_current_utc_datetime

SLIDES_ROUTER = APIRouter(prefix="/slides", tags=["Slides"])
PRESENTATION_OPS_ROUTER = APIRouter(prefix="/presentation", tags=["Presentation"])


class DuplicateSlideRequest(BaseModel):
    at_index: int | None = None


class AddSlideRequest(BaseModel):
    # id layout'а из каталога презентации либо пустой слайд __blank_slide__
    layout: str = BLANK_PRESENTATION_LAYOUT_ID
    at_index: int | None = None


class SlidesOrderRequest(BaseModel):
    slide_ids: list[uuid.UUID]


async def _deck_slides(session: AsyncSession, presentation_id: uuid.UUID) -> list[SlideModel]:
    return list(
        (
            await session.scalars(
                select(SlideModel)
                .where(SlideModel.presentation == presentation_id)
                .order_by(SlideModel.index)
            )
        ).all()
    )


async def _slide_or_404(session: AsyncSession, slide_id: uuid.UUID) -> SlideModel:
    slide = await session.get(SlideModel, slide_id)
    if slide is None:
        raise HTTPException(status_code=404, detail="Slide not found")
    return slide


async def _renumber(session: AsyncSession, slides: list[SlideModel]) -> None:
    """Проставить последовательные index по порядку списка."""
    for position, slide in enumerate(slides):
        slide.index = position
        session.add(slide)


def _deck_layout_group(deck_slides: list[SlideModel], presentation: PresentationModel) -> str:
    if deck_slides:
        first = deck_slides[0]
        if isinstance(first.layout_group, str) and first.layout_group.strip():
            return first.layout_group.strip()
    layout = presentation.layout
    if isinstance(layout, dict) and isinstance(layout.get("name"), str) and layout["name"].strip():
        return layout["name"].strip()
    return "presentation"


def _clamp_at_index(at_index: int | None, length: int) -> int:
    if at_index is None:
        return length
    return max(0, min(at_index, length))


# ---------------------------------------------------------------------------
# POST /slides/{slide_id}/duplicate — копия слайда
# ---------------------------------------------------------------------------
@SLIDES_ROUTER.post("/{slide_id}/duplicate", response_model=SlideModel)
async def duplicate_slide(
    slide_id: uuid.UUID,
    request: DuplicateSlideRequest | None = None,
    sql_session: AsyncSession = Depends(get_async_session),
):
    slide = await _slide_or_404(sql_session, slide_id)
    deck_slides = await _deck_slides(sql_session, slide.presentation)
    if len(deck_slides) >= MAX_NUMBER_OF_SLIDES:
        raise HTTPException(
            status_code=400,
            detail=f"Number of slides cannot be greater than {MAX_NUMBER_OF_SLIDES}",
        )

    at_index = _clamp_at_index(
        request.at_index if request else None,
        len(deck_slides),
    )
    duplicated = SlideModel(
        presentation=slide.presentation,
        layout_group=slide.layout_group,
        layout=slide.layout,
        index=at_index,
        speaker_note=slide.speaker_note,
        content=copy.deepcopy(slide.content),
        html_content=slide.html_content,
        properties=copy.deepcopy(slide.properties),
        ui=copy.deepcopy(slide.ui),
    )
    sql_session.add(duplicated)
    await sql_session.flush()

    deck_slides.insert(at_index, duplicated)
    await _renumber(sql_session, deck_slides)
    await sql_session.commit()
    await sql_session.refresh(duplicated)
    return duplicated


# ---------------------------------------------------------------------------
# DELETE /slides/{slide_id} — удаление слайда
# ---------------------------------------------------------------------------
@SLIDES_ROUTER.delete("/{slide_id}", status_code=204)
async def delete_slide(
    slide_id: uuid.UUID,
    sql_session: AsyncSession = Depends(get_async_session),
):
    slide = await _slide_or_404(sql_session, slide_id)
    deck_slides = await _deck_slides(sql_session, slide.presentation)
    await sql_session.delete(slide)
    remaining = [other for other in deck_slides if other.id != slide_id]
    await _renumber(sql_session, remaining)
    await sql_session.commit()


# ---------------------------------------------------------------------------
# POST /presentation/{id}/slides — добавить слайд (blank или по заготовке)
# ---------------------------------------------------------------------------
@PRESENTATION_OPS_ROUTER.post("/{id}/slides", response_model=SlideModel)
async def add_presentation_slide(
    id: uuid.UUID,
    request: AddSlideRequest | None = None,
    sql_session: AsyncSession = Depends(get_async_session),
):
    presentation = await sql_session.get(PresentationModel, id)
    if presentation is None:
        raise HTTPException(status_code=404, detail="Presentation not found")

    deck_slides = await _deck_slides(sql_session, id)
    if len(deck_slides) >= MAX_NUMBER_OF_SLIDES:
        raise HTTPException(
            status_code=400,
            detail=f"Number of slides cannot be greater than {MAX_NUMBER_OF_SLIDES}",
        )

    layout_code = (
        request.layout if request else BLANK_PRESENTATION_LAYOUT_ID
    ) or BLANK_PRESENTATION_LAYOUT_ID
    if layout_code != BLANK_PRESENTATION_LAYOUT_ID:
        if not _is_template_layout_payload(presentation.layout):
            raise HTTPException(
                status_code=422,
                detail="Presentation has no layout catalog; only blank slides can be added",
            )
        ui = _template_slide_ui(presentation.layout, layout_code)
        if ui is None:
            raise HTTPException(status_code=422, detail=f"Unknown slide layout '{layout_code}'")
        layout_group = _deck_layout_group(deck_slides, presentation)
    else:
        ui = _blank_presentation_slide_ui()
        layout_group = BLANK_PRESENTATION_LAYOUT_GROUP

    at_index = _clamp_at_index(request.at_index if request else None, len(deck_slides))

    slide = SlideModel(
        presentation=id,
        layout_group=layout_group,
        layout=layout_code,
        index=at_index,
        content={},
        speaker_note="",
        ui=ui,
    )
    sql_session.add(slide)
    await sql_session.flush()
    deck_slides.insert(at_index, slide)
    await _renumber(sql_session, deck_slides)

    presentation.updated_at = get_current_utc_datetime()
    sql_session.add(presentation)
    await sql_session.commit()
    await sql_session.refresh(slide)
    return slide


# ---------------------------------------------------------------------------
# PATCH /presentation/{id}/slides-order — переупорядочивание слайдов
# ---------------------------------------------------------------------------
@PRESENTATION_OPS_ROUTER.patch("/{id}/slides-order")
async def reorder_presentation_slides(
    id: uuid.UUID,
    request: SlidesOrderRequest,
    sql_session: AsyncSession = Depends(get_async_session),
):
    presentation = await sql_session.get(PresentationModel, id)
    if presentation is None:
        raise HTTPException(status_code=404, detail="Presentation not found")

    deck_slides = await _deck_slides(sql_session, id)
    requested = [str(slide_id) for slide_id in request.slide_ids]
    current = [str(slide.id) for slide in deck_slides]
    if len(requested) != len(current) or set(requested) != set(current):
        raise HTTPException(
            status_code=400,
            detail="slide_ids must be a permutation of the current deck slides",
        )

    by_id = {str(slide.id): slide for slide in deck_slides}
    await _renumber(sql_session, [by_id[slide_id] for slide_id in requested])

    presentation.updated_at = get_current_utc_datetime()
    sql_session.add(presentation)
    await sql_session.commit()
    return {"ok": True, "slides": len(deck_slides)}


# ---------------------------------------------------------------------------
# GET /presentation/{id}/layout-catalog — заготовки слайдов текущего шаблона
# ---------------------------------------------------------------------------
@PRESENTATION_OPS_ROUTER.get("/{id}/layout-catalog")
async def presentation_layout_catalog(
    id: uuid.UUID,
    sql_session: AsyncSession = Depends(get_async_session),
):
    presentation = await sql_session.get(PresentationModel, id)
    if presentation is None:
        raise HTTPException(status_code=404, detail="Presentation not found")

    catalog: list[dict[str, Any]] = []
    source = "none"
    payload = presentation.layout
    if _is_template_layout_payload(payload) and isinstance(payload, dict):
        source = "template"
        seen: set[str] = set()
        for layout in payload.get("layouts") or []:
            if not isinstance(layout, dict):
                continue
            layout_id = str(layout.get("id") or "")
            if not layout_id or layout_id in seen:
                continue
            seen.add(layout_id)
            description = layout.get("description")
            catalog.append(
                {
                    "code": layout_id,
                    "description": description if isinstance(description, str) else None,
                }
            )

    if not catalog:
        source = "deck"
        for slide in await _deck_slides(sql_session, id):
            description = None
            if isinstance(slide.ui, dict):
                description = slide.ui.get("description")
            catalog.append(
                {
                    "code": slide.layout,
                    "description": description if isinstance(description, str) else None,
                }
            )

    return {"catalog": catalog, "source": source, "blank": BLANK_PRESENTATION_LAYOUT_ID}
