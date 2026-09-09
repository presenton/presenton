import json

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
from services.r1_sources import extract_document_source, extract_url_source, persist_inline_snapshot
from utils.get_env import get_app_data_directory_env

R1_ROUTER = APIRouter(prefix="/r1", tags=["R1"])


class CompositionApply(BaseModel):
    document_id: str
    slide_id: str
    composition_id: str


class SourceExtract(BaseModel):
    file_path: str


class IntegrationSnapshot(BaseModel):
    url: str
    text: Optional[str] = None


class IntegrationApply(BaseModel):
    document_id: str
    snapshot_id: str


class NielsenPull(BaseModel):
    market_panel: str = "Total National Urban"
    document_id: Optional[str] = None


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


class SourceUrl(BaseModel):
    url: str


@R1_ROUTER.post("/integrations/snapshot")
async def integrations_snapshot(body: IntegrationSnapshot):
    if body.text is not None:
        extracted = persist_inline_snapshot(body.url, body.text)
    else:
        extracted = extract_url_source(body.url)
    return {
        "kind": "integration-snapshot",
        "id": extracted.get("id"),
        "url": body.url,
        "engine": extracted.get("engine"),
        "facts": extracted.get("numbers") or [],
        "snapshot_path": extracted.get("snapshot_path"),
        "text": (extracted.get("text") or "")[:2000],
    }


@R1_ROUTER.post("/integrations/nielsen")
async def integrations_nielsen(body: NielsenPull, sql_session: AsyncSession = Depends(get_async_session)):
    from urllib.request import Request, urlopen
    hop = Request(
        "http://172.22.0.1:8318/",
        data=json.dumps({"nielsen": True, "market_panel": body.market_panel}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(hop, timeout=90) as resp:
            payload = json.loads(resp.read().decode() or "{}")
        text = str(payload.get("text") or "")
        facts = json.loads(text) if text.startswith("{") else {}
    except Exception as exc:
        raise HTTPException(422, f"nielsen hop failed: {exc}") from exc
    if not facts.get("ty"):
        raise HTTPException(422, "nielsen hop empty")
    extracted = persist_inline_snapshot("http://10.228.8.51/admin-api", json.dumps(facts))
    result = {"kind": "integration-snapshot", "id": extracted.get("id"), "facts": facts}
    if body.document_id:
        applied = await integrations_apply(IntegrationApply(document_id=body.document_id, snapshot_id=extracted["id"]), sql_session)
        result["apply"] = applied
    return result


@R1_ROUTER.post("/integrations/apply")
async def integrations_apply(body: IntegrationApply, sql_session: AsyncSession = Depends(get_async_session)):
    from pathlib import Path
    snap_path = Path(get_app_data_directory_env()) / "sources" / f"{body.snapshot_id}.json"
    if not snap_path.exists():
        raise HTTPException(404, "snapshot not found")
    payload = json.loads(snap_path.read_text())
    snapshot = await load_document_snapshot(sql_session, body.document_id)
    if not snapshot["slides"]:
        raise HTTPException(422, "document has no slides")
    slide_id = snapshot["slides"][0]["id"]
    facts = payload.get("numbers") or []
    label = str((payload.get("source") or {}).get("url") or payload.get("filename") or "BI-HUB")
    value = payload.get("engine") or "ok"
    unit = "Nielsen MAT money units (not RUB without glossary)"
    ly = ty = None
    try:
        parsed = json.loads(payload.get("text") or "")
        if isinstance(parsed, dict):
            value = str(parsed.get("ty") or parsed.get("version") or parsed.get("service") or value)
            unit = str(parsed.get("unit") or unit)
            panel = parsed.get("market_panel") or ""
            svc = parsed.get("service") or "BI-HUB"
            label = (str(svc) + " · " + str(panel) + " · " + unit)[:120]
            ly = parsed.get("ly")
            ty = parsed.get("ty")
    except Exception:
        if facts:
            value = str(facts[0])
    elements = [
        {"type": "text", "name": "kpi_value", "runs": [{"text": str(int(ty) if ty is not None else value)}],
         "position": {"x": 40, "y": 40}, "size": {"width": 500, "height": 70}},
        {"type": "text", "name": "kpi_label", "runs": [{"text": label[:120]}],
         "position": {"x": 40, "y": 110}, "size": {"width": 900, "height": 40}},
    ]
    if ly is not None and ty is not None:
        elements.extend([
            {"type": "text", "name": "kpi_ly", "runs": [{"text": str(int(ly))}],
             "position": {"x": 40, "y": 160}, "size": {"width": 400, "height": 48}},
            {"type": "chart", "chart_type": "bar", "name": "nielsen_ty_ly",
             "position": {"x": 40, "y": 220}, "size": {"width": 900, "height": 360},
             "categories": ["MAT LY", "MAT TY"],
             "series": [{"name": "money__mat", "values": [float(ly), float(ty)]}]},
        ])
    ui = {"components": [{"id": "bi_hub_kpi", "elements": elements}]}
    result = await execute_operation(
        sql_session,
        document_id=body.document_id,
        base_revision=snapshot["revision"],
        operations=[{"scope": "slide", "targetIds": [slide_id], "operationType": "UpdateSlide", "payload": {"ui": ui}}],
        actor_source="integration",
    )
    result["snapshot_id"] = body.snapshot_id
    return result


@R1_ROUTER.post("/sources/extract-url")
async def sources_extract_url(body: SourceUrl):
    return extract_url_source(body.url)


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


class BatchApply(BaseModel):
    document_id: str
    targetIds: list[str]
    operationType: str
    payload: dict[str, Any]
    scope: str = "slide"


@R1_ROUTER.post("/batch")
async def batch_apply(body: BatchApply, sql_session: AsyncSession = Depends(get_async_session)):
    if not body.targetIds:
        raise HTTPException(422, "targetIds required")
    if len(body.targetIds) > 50:
        raise HTTPException(422, "too many targets")
    snapshot = await load_document_snapshot(sql_session, body.document_id)
    operations = [
        {
            "scope": body.scope,
            "targetIds": [sid],
            "operationType": body.operationType,
            "payload": body.payload,
        }
        for sid in body.targetIds
    ]
    return await execute_operation(
        sql_session,
        document_id=body.document_id,
        base_revision=snapshot["revision"],
        operations=operations,
        actor_source="batch",
    )


class QualityFix(BaseModel):
    codes: list[str] = ["empty_image", "overflow_text", "empty_slide"]


def _replace_placeholder_images(tree, src: str) -> int:
    changed = 0
    if isinstance(tree, dict):
        if tree.get("type") == "image":
            data = str(tree.get("data") or tree.get("src") or "")
            if (not data) or ("placeholder" in data):
                tree["data"] = src
                changed += 1
        for value in tree.values():
            changed += _replace_placeholder_images(value, src)
    elif isinstance(tree, list):
        for item in tree:
            changed += _replace_placeholder_images(item, src)
    return changed


@R1_ROUTER.post("/quality/{document_id}/fix")
async def quality_fix(
    document_id: str,
    body: QualityFix | None = None,
    sql_session: AsyncSession = Depends(get_async_session),
):
    from copy import deepcopy
    from services.r1_assets import list_assets

    from services.r1_quality import fill_empty_slide_ui, shorten_overflow_text

    codes = set((body.codes if body else None) or ["empty_image", "overflow_text", "empty_slide"])
    snapshot = await load_document_snapshot(sql_session, document_id)
    report = check_presentation(snapshot)
    assets = list_assets(limit=1)
    if "empty_image" in codes and not assets and any(i["code"] == "empty_image" for i in report["issues"]):
        raise HTTPException(422, "No library asset to replace empty images")
    src = None
    if assets:
        path = str(assets[0]["path"])
        src = path[path.index("/app_data/") :] if "/app_data/" in path else path
    operations = []
    for slide in snapshot["slides"]:
        issues = [i for i in report["issues"] if i.get("slideId") == slide["id"]]
        codes_here = {i["code"] for i in issues} & codes
        if not codes_here:
            continue
        ui = deepcopy(slide.get("ui") or {})
        changed = False
        if "empty_image" in codes_here and src and _replace_placeholder_images(ui, src):
            changed = True
        if "overflow_text" in codes_here and shorten_overflow_text(ui):
            changed = True
        if "empty_slide" in codes_here:
            ui = fill_empty_slide_ui(ui if ui else None)
            changed = True
        if changed:
            operations.append(
                {
                    "scope": "slide",
                    "targetIds": [slide["id"]],
                    "operationType": "UpdateSlide",
                    "payload": {"ui": ui},
                }
            )
    if not operations:
        return {"ok": True, "fixed": 0, "status": "noop"}
    result = await execute_operation(
        sql_session,
        document_id=document_id,
        base_revision=snapshot["revision"],
        operations=operations,
        actor_source="quality-fix",
    )
    result["fixed"] = len(operations)
    return result
