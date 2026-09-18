
import uuid
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from models.sql.presentation import PresentationModel
from services.brand_pack import (
    apply_tokens_to_ui,
    list_brand_packs,
    load_brand_pack,
    presentation_theme_from_pack,
    save_brand_pack,
    update_brand_pack,
)
from services.database import get_async_session
from services.operation_executor import execute_operation, load_document_snapshot

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
    snapshot = await load_document_snapshot(sql_session, str(document_id))
    ops: list[dict[str, Any]] = [
        {
            "scope": "document",
            "targetIds": [],
            "operationType": "ApplyBrandPack",
            "payload": {"brandPackId": pack["id"]},
        }
    ]
    old_theme = snapshot.get("theme") or {}
    old_colors = {}
    if isinstance(old_theme, dict):
        data = old_theme.get("data") if isinstance(old_theme.get("data"), dict) else old_theme
        old_colors = data.get("colors") if isinstance(data.get("colors"), dict) else {}
    if not old_colors:
        old_colors = {
            "primary": "#4a6ebd",
            "background": "#ffffff",
            "card": "#e8e8e8",
            "stroke": "#d1d1d1",
            "primary_text": "#dedede",
            "background_text": "#060301",
            "graph_0": "#09256d",
            "graph_1": "#1c3c86",
            "graph_2": "#3153a0",
            "graph_3": "#476bba",
        }
    tokens = pack.get("tokens") or {}
    new_colors = tokens.get("colors") or {}
    fonts = tokens.get("fonts") if isinstance(tokens.get("fonts"), dict) else {}
    logo = tokens.get("logo")
    for slide in snapshot.get("slides") or []:
        ui = apply_tokens_to_ui(slide.get("ui") or {}, new_colors, fonts, pack["id"])
        if logo and isinstance(ui, dict):
            els = list(ui.get("elements") or [])
            found = False
            for el in els:
                if isinstance(el, dict) and el.get("name") == "brand_logo":
                    el["data"] = logo
                    found = True
            if not found:
                els.append({
                    "type": "image",
                    "name": "brand_logo",
                    "data": logo,
                    "position": {"x": 40, "y": 16},
                    "size": {"width": 140, "height": 40},
                })
            ui["elements"] = els
        ops.append(
            {
                "scope": "slide",
                "targetIds": [slide["id"]],
                "operationType": "UpdateSlide",
                "payload": {"ui": ui},
            }
        )
    return await execute_operation(
        sql_session,
        document_id=document_id,
        base_revision=presentation.revision,
        operations=ops,
        operation_id=str(uuid.uuid4()),
        actor_source="manual",
    )


@BRAND_PACKS_ROUTER.put("/{pack_id}")
async def put_brand_pack(pack_id: str, body: dict[str, Any] = Body(...)) -> dict[str, Any]:
    return update_brand_pack(pack_id, body)
