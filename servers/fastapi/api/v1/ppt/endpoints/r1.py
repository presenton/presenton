from pathlib import Path
import json
import uuid

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
from services.brand_pack import pack_components
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


NIELSEN_UNITS = {
    "money__mat_ty": "MAT TY, Nielsen money units (not RUB without glossary)",
    "money__mat_ly": "MAT LY, Nielsen money units (not RUB without glossary)",
    "money__mat_yoy_pct": "MAT YoY %, Nielsen (share points not RUB)",
}


NIELSEN_PANELS = [
    "Total National Urban",
    "Total Volga Region",
    "Moscow",
]


@R1_ROUTER.get("/integrations/units")
async def nielsen_units():
    return {"units": NIELSEN_UNITS, "panels": NIELSEN_PANELS}



class PackApply(BaseModel):
    document_id: str


@R1_ROUTER.get("/packs/{pack_id}/components")
async def pack_component_catalog(pack_id: str):
    return pack_components(pack_id)


@R1_ROUTER.post("/packs/{pack_id}/apply")
async def apply_dozer_pack(pack_id: str, body: PackApply, sql_session: AsyncSession = Depends(get_async_session)):
    from services.brand_pack import load_brand_pack
    pack = load_brand_pack(pack_id)
    comps = pack_components(pack_id)
    snapshot = await load_document_snapshot(sql_session, body.document_id)
    if not snapshot["slides"]:
        raise HTTPException(422, "document has no slides")
    primary = ((pack.get("tokens") or {}).get("colors") or {}).get("primary") or "7A5AF8"
    primary = str(primary).lstrip("#")

    def restyle(ui):
        from copy import deepcopy
        tree = deepcopy(ui or {})
        def walk(node):
            if isinstance(node, dict):
                if node.get("type") == "text":
                    node["color"] = primary
                    for run in node.get("runs") or []:
                        if isinstance(run, dict):
                            run["color"] = primary
                for value in list(node.values()):
                    walk(value)
            elif isinstance(node, list):
                for item in node:
                    walk(item)
        walk(tree)
        tree["pack_restyle"] = pack["id"]
        return tree

    punch = {
        "components": [{
            "id": "dozer_punch",
            "elements": [
                {"type": "text", "name": "kpi_value_1", "runs": [{"text": "10", "color": primary}],
                 "color": primary, "position": {"x": 40, "y": 80}, "size": {"width": 280, "height": 70}},
                {"type": "text", "name": "kpi_label_1", "runs": [{"text": "KPI", "color": primary}],
                 "color": primary, "position": {"x": 40, "y": 150}, "size": {"width": 280, "height": 32}},
                {"type": "text", "name": "kpi_value_2", "runs": [{"text": "20", "color": primary}],
                 "color": primary, "position": {"x": 360, "y": 80}, "size": {"width": 280, "height": 70}},
                {"type": "text", "name": "kpi_label_2", "runs": [{"text": "KPI row", "color": primary}],
                 "color": primary, "position": {"x": 360, "y": 150}, "size": {"width": 280, "height": 32}},
                {"type": "chart", "chart_type": "waterfall", "name": "pack_waterfall",
                 "position": {"x": 40, "y": 220}, "size": {"width": 900, "height": 320},
                 "categories": ["Start", "Plus", "Minus"],
                 "series": [{"name": "delta", "values": [10, 5, -3]}]},
            ],
        }],
        "pack_restyle": pack["id"],
    }
    ops = [
        {"scope": "document", "targetIds": [], "operationType": "ApplyBrandPack", "payload": {"brandPackId": pack["id"]}},
    ]
    for i, slide in enumerate(snapshot["slides"]):
        ui = punch if i == 0 else restyle(slide.get("ui") or {})
        ops.append({"scope": "slide", "targetIds": [slide["id"]], "operationType": "UpdateSlide", "payload": {"ui": ui}})
    result = await execute_operation(
        sql_session,
        document_id=body.document_id,
        base_revision=snapshot["revision"],
        operations=ops,
        actor_source="brand-pack",
    )
    result["components"] = comps
    return result


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
        bind = {
            "market_panel": body.market_panel,
            "snapshot_id": extracted.get("id"),
            "ty": facts.get("ty"),
            "ly": facts.get("ly"),
            "kind": "regular-report",
        }
        _report_path(body.document_id).write_text(json.dumps(bind))
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


R2_ROUTER = APIRouter(prefix="/r2", tags=["R2"])
R2_VARIANTS = ["matrix-2x2", "split-60-40", "split-40-60"]


def _report_path(document_id: str):
    from pathlib import Path as P
    from utils.get_env import get_app_data_directory_env
    root = P(get_app_data_directory_env() or "/tmp/presenton") / "sources"
    root.mkdir(parents=True, exist_ok=True)
    return root / f"report-{document_id}.json"


class VariantBody(BaseModel):
    document_id: str
    slide_id: str
    composition_id: Optional[str] = None


class ReportRefresh(BaseModel):
    document_id: str


@R2_ROUTER.post("/variants/propose")
async def variants_propose(body: VariantBody, sql_session: AsyncSession = Depends(get_async_session)):
    snapshot = await load_document_snapshot(sql_session, body.document_id)
    slide = next((s for s in snapshot["slides"] if str(s["id"]) == body.slide_id), None)
    if not slide:
        raise HTTPException(404, "Slide not found")
    current = str((slide.get("layout") or slide.get("composition_id") or ""))
    variants = [{"id": v, "composition_id": v} for v in R2_VARIANTS if v != current]
    return {"base": current or None, "variants": variants, "kept_until_apply": True}


@R2_ROUTER.post("/variants/apply")
async def variants_apply(body: VariantBody, sql_session: AsyncSession = Depends(get_async_session)):
    if not body.composition_id:
        raise HTTPException(422, "composition_id required")
    return await compositions_apply(
        CompositionApply(document_id=body.document_id, slide_id=body.slide_id, composition_id=body.composition_id),
        sql_session,
    )


@R2_ROUTER.get("/reports/{document_id}")
async def reports_get(document_id: str):
    path = _report_path(document_id)
    if not path.exists():
        return {"bound": False}
    return {"bound": True, **json.loads(path.read_text())}


@R2_ROUTER.post("/reports/refresh")
async def reports_refresh(body: ReportRefresh, sql_session: AsyncSession = Depends(get_async_session)):
    path = _report_path(body.document_id)
    panel = "Total National Urban"
    if path.exists():
        panel = str(json.loads(path.read_text()).get("market_panel") or panel)
    pulled = await integrations_nielsen(NielsenPull(market_panel=panel, document_id=body.document_id), sql_session)
    binding = {
        "market_panel": panel,
        "snapshot_id": pulled.get("id"),
        "ty": (pulled.get("facts") or {}).get("ty"),
        "ly": (pulled.get("facts") or {}).get("ly"),
        "kind": "regular-report",
    }
    path.write_text(json.dumps(binding))
    return {"refreshed": True, **binding}



def _collab_path(document_id: str):
    from utils.get_env import get_app_data_directory_env
    root = Path(get_app_data_directory_env() or "/tmp/presenton") / "sources"
    root.mkdir(parents=True, exist_ok=True)
    return root / ("collab-%s.json" % document_id)


def _load_collab(document_id: str) -> dict:
    path = _collab_path(document_id)
    if not path.exists():
        return {"comments": [], "presence": []}
    try:
        data = json.loads(path.read_text())
    except Exception:
        data = {}
    data.setdefault("comments", [])
    data.setdefault("presence", [])
    return data


class CollabComment(BaseModel):
    document_id: str
    slide_id: str
    text: str
    author: str = "user"


class CollabPresence(BaseModel):
    document_id: str
    actor: str = "user"
    slide_id: Optional[str] = None


@R2_ROUTER.get("/collab/{document_id}")
async def collab_get(document_id: str):
    return _load_collab(document_id)


@R2_ROUTER.post("/collab/comments")
async def collab_comment(body: CollabComment):
    data = _load_collab(body.document_id)
    item = {
        "id": uuid.uuid4().hex[:12],
        "slide_id": body.slide_id,
        "text": (body.text or "").strip()[:500],
        "author": (body.author or "user")[:64],
    }
    if not item["text"]:
        raise HTTPException(422, "empty comment")
    data["comments"].append(item)
    _collab_path(body.document_id).write_text(json.dumps(data))
    return item


@R2_ROUTER.post("/collab/presence")
async def collab_presence(body: CollabPresence):
    import time
    data = _load_collab(body.document_id)
    now = time.time()
    others = [p for p in data["presence"] if now - float(p.get("ts") or 0) < 60 and p.get("actor") != body.actor]
    others.append({"actor": body.actor[:64], "slide_id": body.slide_id, "ts": now})
    data["presence"] = others
    _collab_path(body.document_id).write_text(json.dumps(data))
    return {"ok": True, "presence": others}
