
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from models.sql.slide import SlideModel
from services.database import get_async_session
from services.operation_executor import execute_operation, load_document_snapshot
from services.r1_assets import list_assets
from services.r1_compositions import apply_composition, list_compositions
from services.r1_infographic import apply_model, model_from_element
from services.r1_quality import check_presentation
from services.r1_sources import extract_document_source

R1_ROUTER = APIRouter(prefix="/r1", tags=["R1"])


class CompositionApply(BaseModel):
    document_id: str
    slide_id: str
    composition_id: str


class SourceExtract(BaseModel):
    file_path: str


class InfographicBody(BaseModel):
    element: dict[str, Any]
    model: Optional[dict[str, Any]] = None


@R1_ROUTER.get("/compositions")
async def compositions():
    return list_compositions()


@R1_ROUTER.post("/compositions/apply")
async def compositions_apply(body: CompositionApply, sql_session: AsyncSession = Depends(get_async_session)):
    snapshot = await load_document_snapshot(sql_session, body.document_id)
    slide = next((s for s in snapshot["slides"] if str(s["id"]) == body.slide_id), None)
    if not slide:
        raise HTTPException(404, "Slide not found")
    before_content = slide.get("content")
    next_slide = apply_composition(slide, body.composition_id)
    result = await execute_operation(
        sql_session,
        document_id=body.document_id,
        base_revision=snapshot["revision"],
        operations=[
            {
                "scope": "slide",
                "targetIds": [body.slide_id],
                "operationType": "UpdateSlide",
                "payload": {
                    "layout_group": next_slide["layout_group"],
                    "layout": next_slide["layout"],
                },
            }
        ],
    )
    after = await load_document_snapshot(sql_session, body.document_id)
    after_slide = next(s for s in after["slides"] if str(s["id"]) == body.slide_id)
    if after_slide.get("content") != before_content:
        raise HTTPException(500, "Composition apply mutated content")
    return result


@R1_ROUTER.post("/sources/extract")
async def sources_extract(body: SourceExtract):
    return extract_document_source(body.file_path)


@R1_ROUTER.get("/assets")
async def assets():
    return list_assets()


@R1_ROUTER.get("/quality/{document_id}")
async def quality(document_id: str, sql_session: AsyncSession = Depends(get_async_session)):
    snapshot = await load_document_snapshot(sql_session, document_id)
    return check_presentation(snapshot)


@R1_ROUTER.post("/infographic/model")
async def infographic_model(body: InfographicBody):
    if body.model:
        return apply_model(body.element, body.model)
    return model_from_element(body.element)
