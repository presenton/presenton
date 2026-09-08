
import uuid
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from models.sql.presentation import PresentationModel
from services.brand_pack import (
    list_brand_packs,
    load_brand_pack,
    presentation_theme_from_pack,
    save_brand_pack,
)
from services.database import get_async_session
from services.operation_executor import execute_operation

BRAND_PACKS_ROUTER = APIRouter(prefix="/brand-packs", tags=["Brand packs"])


@BRAND_PACKS_ROUTER.get("")
async def get_brand_packs() -> list[dict[str, Any]]:
    return list_brand_packs()


@BRAND_PACKS_ROUTER.post("")
async def create_brand_pack(body: dict[str, Any] = Body(...)) -> dict[str, Any]:
    return save_brand_pack(body)


@BRAND_PACKS_ROUTER.get("/{pack_id}")
async def get_brand_pack(pack_id: str) -> dict[str, Any]:
    return load_brand_pack(pack_id)


@BRAND_PACKS_ROUTER.post("/{pack_id}/apply/{document_id}")
async def apply_brand_pack(
    pack_id: str,
    document_id: uuid.UUID,
    sql_session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    presentation = await sql_session.get(PresentationModel, document_id)
    if not presentation:
        raise HTTPException(404, "Presentation not found")
    pack = load_brand_pack(pack_id)
    return await execute_operation(
        sql_session,
        document_id=document_id,
        base_revision=presentation.revision,
        operations=[
            {
                "scope": "document",
                "targetIds": [],
                "operationType": "ApplyBrandPack",
                "payload": {"brandPackId": pack["id"]},
            }
        ],
        operation_id=str(uuid.uuid4()),
        actor_source="manual",
    )
