"""Unified operation executor with document revision and idempotency.

Not a general CRDT/OT system. Guards only the paths that route through this
service. SQLite laboratory implementation.
"""
import hashlib
import json
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from api.v1.auth.context import get_current_owner_id, get_current_owner_is_admin
from constants.presentation import MAX_NUMBER_OF_SLIDES
from models.sql.operation import OperationModel, OperationState
from models.sql.presentation import PresentationModel
from models.sql.slide import SlideModel
from services.slide_compare_and_swap import MUTABLE_FIELDS


def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def operation_request_hash(payload: dict) -> str:
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()


async def _get_owned_document(session: AsyncSession, document_id) -> PresentationModel:
    owner_id = get_current_owner_id()
    presentation = await session.get(PresentationModel, document_id)
    if presentation is None or (owner_id is not None and presentation.owner_id != owner_id):
        raise HTTPException(404, "Presentation not found.")
    return presentation


def _slide_value(slide: SlideModel) -> dict:
    return {
        "id": str(slide.id),
        "presentation": str(slide.presentation),
        "index": slide.index,
        **{key: getattr(slide, key) for key in MUTABLE_FIELDS},
    }


def document_snapshot(presentation: PresentationModel, slides: list[SlideModel]) -> dict:
    return {
        "document_id": str(presentation.id),
        "revision": presentation.revision,
        "title": presentation.title,
        "theme": presentation.theme,
        "n_slides": presentation.n_slides,
        "slides": [_slide_value(slide) for slide in slides],
    }


async def load_document_snapshot(session: AsyncSession, document_id) -> dict:
    presentation = await _get_owned_document(session, uuid.UUID(str(document_id)))
    slides = list(
        (
            await session.scalars(
                select(SlideModel)
                .where(SlideModel.presentation == uuid.UUID(str(document_id)))
                .order_by(SlideModel.index)
            )
        ).all()
    )
    snap = document_snapshot(presentation, slides)
    last = (
        await session.scalars(
            select(OperationModel)
            .where(OperationModel.document_id == uuid.UUID(str(document_id)))
            .order_by(OperationModel.created_at.desc())
        )
    ).first()
    snap["lastOperationId"] = str(last.operation_id) if last is not None else None
    return snap


async def _load_operation(session: AsyncSession, document_id, operation_id) -> OperationModel | None:
    document_uuid = uuid.UUID(str(document_id))
    operation_uuid = uuid.UUID(str(operation_id))
    result = await session.scalars(
        select(OperationModel).where(
            OperationModel.document_id == document_uuid,
            OperationModel.operation_id == operation_uuid,
        )
    )
    return result.first()


def _validate_targets(document: dict, operation: dict) -> None:
    targets = operation.get("targetIds") or []
    if not isinstance(targets, list):
        raise HTTPException(422, "targetIds must be a list.")
    scope = operation.get("scope")
    if scope == "document":
        if targets:
            raise HTTPException(422, "Document scope cannot target specific slides.")
        return
    slide_ids = {slide["id"] for slide in document["slides"]}
    element_ids = {
        str(component.get("id"))
        for slide in document["slides"]
        for component in (slide.get("ui") or {}).get("components", [])
        if isinstance(component, dict) and component.get("id")
    }
    if not targets:
        raise HTTPException(428, "Explicit targetIds are required for element/slide/selection scope.")
    for target in targets:
        if scope == "slide":
            if target not in slide_ids:
                raise HTTPException(422, f"Unknown slide target: {target}")
        elif scope in ("element", "selection"):
            if target not in element_ids and target not in slide_ids:
                raise HTTPException(422, f"Unknown target: {target}")
        else:
            raise HTTPException(422, f"Unsupported scope: {scope}")


def _normalize_slide_payload(raw_slide: dict, presentation_id, owner_id, index: int) -> SlideModel:
    try:
        slide = SlideModel.model_validate_json(canonical_json(raw_slide))
        slide.id = uuid.UUID(str(slide.id))
        slide.presentation = uuid.UUID(str(presentation_id))
        slide.index = index
        slide.owner_id = owner_id
    except Exception as exc:
        raise HTTPException(422, "Invalid slide payload.") from exc
    return slide


async def _apply_operations(
    session: AsyncSession,
    presentation: PresentationModel,
    slides: list[SlideModel],
    operations: list[dict],
) -> tuple[list[SlideModel], dict]:
    slide_map = {str(slide.id): slide for slide in slides}
    order = [str(slide.id) for slide in slides]
    metadata = {"title": presentation.title, "theme": presentation.theme, "n_slides": presentation.n_slides}

    def require_slides(target_ids):
        missing = [target for target in target_ids if target not in slide_map]
        if missing:
            raise HTTPException(409, f"Slides no longer exist: {', '.join(missing)}")

    for operation in operations:
        op_type = operation.get("operationType")
        payload = operation.get("payload") or {}
        targets = operation.get("targetIds") or []
        if op_type == "UpdateMetadata":
            if "title" in payload:
                metadata["title"] = payload["title"]
            if "theme" in payload:
                metadata["theme"] = payload["theme"]
            continue
        if op_type == "ApplyBrandPack":
            from services.brand_pack import load_brand_pack, presentation_theme_from_pack
            pack_id = payload.get("brandPackId")
            if not pack_id:
                raise HTTPException(422, "ApplyBrandPack requires brandPackId")
            metadata["theme"] = presentation_theme_from_pack(load_brand_pack(str(pack_id)))
            continue
        if op_type == "UpdateInfographic":
            from copy import deepcopy
            from services.r1_infographic import apply_model, model_from_element
            def _iter(tree):
                if isinstance(tree, dict):
                    if tree.get("type") == "infographic" or tree.get("infographic_type"):
                        yield tree
                    for value in tree.values():
                        yield from _iter(value)
                elif isinstance(tree, list):
                    for item in tree:
                        yield from _iter(item)
            for slide_id in targets:
                slide = slide_map[slide_id]
                ui = deepcopy(slide.ui or {})
                items = list(_iter(ui))
                if not items:
                    raise HTTPException(422, "No infographic on slide")
                item = items[0]
                model = payload.get("model") or model_from_element({**item, "type": "infographic"})
                if payload.get("nodes"):
                    model["nodes"] = payload["nodes"]
                if payload.get("edges"):
                    model["edges"] = payload["edges"]
                updated = apply_model(item, model)
                item.clear()
                item.update(updated)
                slide.ui = ui
                session.add(slide)
            continue
        if op_type in {"UpdateChartType", "UpdateChartData"}:
            from copy import deepcopy
            from services.chart_data import (
                change_chart_type,
                iter_chart_elements,
                replace_chart_values,
            )
            for slide_id in targets:
                slide = slide_map[slide_id]
                ui = deepcopy(slide.ui or {})
                charts = list(iter_chart_elements(ui))
                if not charts:
                    raise HTTPException(422, "No chart element on slide")
                chart = charts[0]
                if op_type == "UpdateChartType":
                    updated = change_chart_type(chart, str(payload.get("chartType") or ""))
                else:
                    updated = replace_chart_values(
                        chart,
                        categories=payload.get("categories"),
                        series=payload.get("series"),
                        unit=payload.get("unit"),
                        period=payload.get("period"),
                        source=payload.get("source"),
                    )
                chart.clear()
                chart.update(updated)
                slide.ui = ui
                session.add(slide)
            continue
        require_slides(targets)
        if op_type == "UpdateSlide":
            for slide_id in targets:
                slide = slide_map[slide_id]
                mutable = {key: payload.get(key, getattr(slide, key)) for key in MUTABLE_FIELDS}
                for key, value in mutable.items():
                    setattr(slide, key, value)
                session.add(slide)
        elif op_type == "InsertSlide":
            source_id = payload.get("sourceSlideId")
            insert_after = payload.get("insertAfterId")
            index = payload.get("index")
            requested_id = payload.get("id")
            if requested_id:
                new_id = str(requested_id)
                if new_id in slide_map:
                    raise HTTPException(409, f"Slide already exists: {new_id}")
            else:
                new_id = None
            if source_id:
                require_slides([source_id])
                source = slide_map[source_id]
                new_slide = source.get_new_slide(presentation.id)
                new_slide.index = -1
                if new_id:
                    new_slide.id = uuid.UUID(new_id)
            else:
                new_slide = SlideModel(
                    id=uuid.UUID(new_id) if new_id else uuid.uuid4(),
                    presentation=presentation.id,
                    layout_group=payload.get("layout_group") or "blank",
                    layout=payload.get("layout") or "__blank_slide__",
                    index=-1,
                    content=payload.get("content") or {},
                    html_content=payload.get("html_content"),
                    speaker_note=payload.get("speaker_note") or "",
                    ui=payload.get("ui"),
                    properties=payload.get("properties"),
                )
                new_slide.owner_id = presentation.owner_id
            slide_map[str(new_slide.id)] = new_slide
            if insert_after and insert_after in order:
                order.insert(order.index(insert_after) + 1, str(new_slide.id))
            elif index is not None and 0 <= index <= len(order):
                order.insert(index, str(new_slide.id))
            else:
                order.append(str(new_slide.id))
            session.add(new_slide)
        elif op_type == "DuplicateSlide":
            for slide_id in targets:
                source = slide_map[slide_id]
                new_slide = source.get_new_slide(presentation.id)
                new_slide.index = -1
                slide_map[str(new_slide.id)] = new_slide
                order.insert(order.index(slide_id) + 1, str(new_slide.id))
                session.add(new_slide)
        elif op_type == "DeleteSlide":
            for slide_id in targets:
                session.expunge(slide_map.pop(slide_id))
                order.remove(slide_id)
        elif op_type == "MoveSlide":
            for slide_id in targets:
                order.remove(slide_id)
                anchor = payload.get("insertAfterId")
                index = payload.get("index")
                if index is not None and 0 <= index <= len(order):
                    order.insert(index, slide_id)
                elif anchor and anchor in order:
                    order.insert(order.index(anchor) + 1, slide_id)
                else:
                    order.append(slide_id)
        else:
            raise HTTPException(422, f"Unsupported operationType: {op_type}")

    if not order:
        raise HTTPException(422, "Document must contain at least one slide.")
    if len(order) > MAX_NUMBER_OF_SLIDES:
        raise HTTPException(422, f"Slide count cannot exceed {MAX_NUMBER_OF_SLIDES}.")
    if len(set(order)) != len(order):
        raise HTTPException(409, "Duplicate slide IDs are not allowed.")
    metadata["n_slides"] = len(order)
    for index, slide_id in enumerate(order):
        slide_map[slide_id].index = index
    return [slide_map[slide_id] for slide_id in order], metadata


async def execute_operation(
    session: AsyncSession,
    *,
    document_id,
    base_revision: int | None,
    operations: list[dict],
    operation_id=None,
    proposal_id=None,
    idempotency_key=None,
    actor_source: str = "manual",
) -> dict:
    if session.bind.dialect.name != "sqlite":
        raise HTTPException(501, "Operation executor currently supports SQLite only.")
    if not operations:
        raise HTTPException(422, "operations must be a nonempty list.")
    if len(operations) > MAX_NUMBER_OF_SLIDES:
        raise HTTPException(422, "Too many operations in one batch.")
    for operation in operations:
        if operation.get("scope") not in {"element", "slide", "selection", "document"}:
            raise HTTPException(422, "Invalid operation scope.")
        if not isinstance(operation.get("payload"), dict):
            raise HTTPException(422, "Each operation must include a payload object.")

    oid = operation_id or str(uuid.uuid4())
    dedupe_key = idempotency_key or oid
    request_hash = operation_request_hash(
        {
            "document_id": str(document_id),
            "base_revision": base_revision,
            "operations": operations,
            "proposal_id": proposal_id,
            "actor_source": actor_source,
        }
    )

    existing = await _load_operation(session, document_id, oid)
    if existing is not None:
        if existing.request_hash != request_hash:
            raise HTTPException(409, "IDEMPOTENCY_CONFLICT")
        if existing.state == OperationState.APPLIED:
            return {
                "operationId": str(existing.operation_id),
                "status": "duplicate",
                "previousRevision": existing.base_revision,
                "resultingRevision": existing.resulting_revision,
                "changedSlideIds": list(existing.changed_slide_ids or []),
                "receipt": existing.receipt,
            }
        raise HTTPException(409, "Operation already recorded in a non-applied state.")

    document_uuid = uuid.UUID(str(document_id))
    existing_key = (
        await session.scalars(
            select(OperationModel).where(
                OperationModel.document_id == document_uuid,
                OperationModel.idempotency_key == dedupe_key,
            )
        )
    ).first()
    if existing_key is not None and str(existing_key.operation_id) != oid:
        if existing_key.request_hash == request_hash:
            return {
                "operationId": str(existing_key.operation_id),
                "status": "duplicate",
                "previousRevision": existing_key.base_revision,
                "resultingRevision": existing_key.resulting_revision,
                "changedSlideIds": list(existing_key.changed_slide_ids or []),
                "receipt": existing_key.receipt,
            }
        raise HTTPException(409, "IDEMPOTENCY_CONFLICT")

    presentation = await _get_owned_document(session, uuid.UUID(str(document_id)))
    current_slides = list(
        (
            await session.scalars(
                select(SlideModel)
                .where(SlideModel.presentation == uuid.UUID(str(document_id)))
                .order_by(SlideModel.index)
            )
        ).all()
    )
    current = document_snapshot(presentation, current_slides)
    baseline_slide_values = {str(slide.id): _slide_value(slide) for slide in current_slides}

    if base_revision is None:
        raise HTTPException(428, "A saved baseRevision is required. No changes were saved.")
    if base_revision != current["revision"]:
        raise HTTPException(409, "REVISION_CONFLICT")

    for operation in operations:
        _validate_targets(current, operation)

    try:
        staged_slides, staged_metadata = await _apply_operations(
            session, presentation, current_slides, operations
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, f"Invalid operation payload: {exc}") from exc

    changed_slide_ids = []
    desired = {
        "title": staged_metadata["title"],
        "theme": staged_metadata["theme"],
        "n_slides": staged_metadata["n_slides"],
        "slides": [_slide_value(slide) for slide in staged_slides],
    }
    if desired != {key: current[key] for key in ("title", "theme", "n_slides", "slides")}:
        previous_revision = current["revision"]
        resulting_revision = previous_revision + 1
        presentation.revision = resulting_revision
        presentation.title = staged_metadata["title"]
        presentation.theme = staged_metadata["theme"]
        presentation.n_slides = staged_metadata["n_slides"]
        presentation.updated_at = datetime.now(timezone.utc)

        existing_slide_ids = {str(slide.id) for slide in current_slides}
        desired_slide_ids = {str(slide.id) for slide in staged_slides}
        removed_ids = list(existing_slide_ids - desired_slide_ids)
        changed_slide_ids = [
            slide_id
            for slide_id in desired_slide_ids
            if slide_id in existing_slide_ids
            and _slide_value(next(s for s in staged_slides if str(s.id) == slide_id))
            != baseline_slide_values.get(slide_id)
        ]

        for slide in current_slides:
            if slide in session:
                session.expunge(slide)
        if removed_ids:
            await session.execute(
                delete(SlideModel).where(
                    SlideModel.presentation == uuid.UUID(str(document_id)),
                    SlideModel.id.in_([uuid.UUID(value) for value in removed_ids]),
                )
            )
        session.add(presentation)
        session.add_all(staged_slides)
        await session.flush()
    else:
        previous_revision = current["revision"]
        resulting_revision = previous_revision

    receipt = {
        "documentId": str(document_id),
        "operationId": oid,
        "status": OperationState.APPLIED,
        "actorId": str(get_current_owner_id() or presentation.owner_id),
        "actorSource": actor_source,
        "baseRevision": base_revision,
        "previousRevision": previous_revision,
        "resultingRevision": resulting_revision,
        "changedSlideIds": changed_slide_ids,
        "changedElementIds": [],
        "proposalId": proposal_id,
        "appliedAt": datetime.now(timezone.utc).isoformat(),
        "inverseOperations": invert_operations(operations, current),
    }
    session.add(
        OperationModel(
            document_id=uuid.UUID(str(document_id)),
            operation_id=uuid.UUID(oid),
            idempotency_key=dedupe_key,
            request_hash=request_hash,
            state=OperationState.APPLIED,
            actor_id=get_current_owner_id(),
            actor_source=actor_source,
            base_revision=base_revision,
            resulting_revision=resulting_revision,
            changed_slide_ids=changed_slide_ids,
            receipt=receipt,
        )
    )
    await session.commit()
    return {
        "operationId": oid,
        "status": "applied",
        "previousRevision": previous_revision,
        "resultingRevision": resulting_revision,
        "changedSlideIds": changed_slide_ids,
        "receipt": receipt,
    }


async def get_operation_receipt(session: AsyncSession, document_id, operation_id) -> dict:
    operation = await _load_operation(session, document_id, operation_id)
    if operation is None:
        raise HTTPException(404, "Operation not found.")
    return operation.receipt or {}


def _as_slide_dict(slide) -> dict:
    if isinstance(slide, dict):
        return {
            "id": str(slide.get("id")),
            "index": slide.get("index"),
            **{key: slide.get(key) for key in MUTABLE_FIELDS},
        }
    return {
        "id": str(slide.id),
        "index": slide.index,
        **{key: getattr(slide, key) for key in MUTABLE_FIELDS},
    }


def build_index_aligned_stream_operations(existing_slides, generated_slides) -> list[dict]:
    """Map generated slides onto the live deck by index.

    Overlapping indices become UpdateSlide on the *existing* UUID.
    Extra generated slides are InsertSlide.
    Extra existing slides are DeleteSlide.
    Never delete-all + insert: that rewrites every slide id.
    """
    def by_index(items):
        return sorted(items, key=lambda item: item["index"] if item["index"] is not None else 0)

    existing = by_index(_as_slide_dict(slide) for slide in (existing_slides or []))
    generated = by_index(_as_slide_dict(slide) for slide in (generated_slides or []))
    if not generated:
        raise HTTPException(422, "Generated presentation must contain at least one slide.")
    if any(not item["id"] or item["id"] == "None" for item in generated):
        raise HTTPException(422, "Generated slides must include ids.")

    operations: list[dict] = []
    overlap = min(len(existing), len(generated))
    for index in range(overlap):
        operations.append(
            {
                "scope": "slide",
                "targetIds": [existing[index]["id"]],
                "operationType": "UpdateSlide",
                "payload": {key: generated[index].get(key) for key in MUTABLE_FIELDS},
            }
        )
    for index in range(len(existing), len(generated)):
        payload = {key: generated[index].get(key) for key in MUTABLE_FIELDS}
        payload["id"] = generated[index]["id"]
        payload["index"] = index
        operations.append(
            {
                "scope": "document",
                "targetIds": [],
                "operationType": "InsertSlide",
                "payload": payload,
            }
        )
    for index in range(len(generated), len(existing)):
        operations.append(
            {
                "scope": "slide",
                "targetIds": [existing[index]["id"]],
                "operationType": "DeleteSlide",
                "payload": {},
            }
        )
    return operations



def invert_operations(operations: list[dict], before_snapshot: dict) -> list[dict]:
    """Build inverse ops from the pre-apply snapshot. Apply in reverse order."""
    slides = {slide["id"]: slide for slide in (before_snapshot.get("slides") or [])}
    order = [slide["id"] for slide in (before_snapshot.get("slides") or [])]
    inverse: list[dict] = []
    for operation in reversed(operations or []):
        op_type = operation.get("operationType")
        targets = operation.get("targetIds") or []
        payload = operation.get("payload") or {}
        if op_type == "UpdateMetadata":
            inverse.append(
                {
                    "scope": "document",
                    "targetIds": [],
                    "operationType": "UpdateMetadata",
                    "payload": {
                        key: before_snapshot.get(key)
                        for key in ("title", "theme")
                        if key in payload
                    },
                }
            )
        elif op_type == "ApplyBrandPack":
            inverse.append(
                {
                    "scope": "document",
                    "targetIds": [],
                    "operationType": "UpdateMetadata",
                    "payload": {"theme": before_snapshot.get("theme")},
                }
            )
        elif op_type in {"UpdateChartType", "UpdateChartData", "UpdateInfographic"}:
            slides = {slide["id"]: slide for slide in (before_snapshot.get("slides") or [])}
            for slide_id in targets:
                old = slides.get(slide_id)
                if not old:
                    continue
                inverse.append(
                    {
                        "scope": "slide",
                        "targetIds": [slide_id],
                        "operationType": "UpdateSlide",
                        "payload": {"ui": old.get("ui")},
                    }
                )
        elif op_type == "UpdateSlide":
            for slide_id in targets:
                old = slides.get(slide_id)
                if not old:
                    continue
                inverse.append(
                    {
                        "scope": "slide",
                        "targetIds": [slide_id],
                        "operationType": "UpdateSlide",
                        "payload": {key: old.get(key) for key in MUTABLE_FIELDS},
                    }
                )
        elif op_type == "InsertSlide":
            new_id = str(payload.get("id") or "")
            if new_id:
                inverse.append(
                    {
                        "scope": "slide",
                        "targetIds": [new_id],
                        "operationType": "DeleteSlide",
                        "payload": {},
                    }
                )
        elif op_type == "DeleteSlide":
            for slide_id in targets:
                old = slides.get(slide_id)
                if not old:
                    continue
                inverse.append(
                    {
                        "scope": "document",
                        "targetIds": [],
                        "operationType": "InsertSlide",
                        "payload": {
                            "id": old["id"],
                            "index": old.get("index") if old.get("index") is not None else len(order),
                            **{key: old.get(key) for key in MUTABLE_FIELDS},
                        },
                    }
                )
        elif op_type == "MoveSlide":
            for slide_id in targets:
                if slide_id in order:
                    inverse.append(
                        {
                            "scope": "slide",
                            "targetIds": [slide_id],
                            "operationType": "MoveSlide",
                            "payload": {"index": order.index(slide_id)},
                        }
                    )
        elif op_type == "DuplicateSlide":
            # inverse cannot know the new UUID here; persist_generated path unused
            continue
    return inverse


async def undo_operation(session: AsyncSession, document_id, operation_id) -> dict:
    receipt = await get_operation_receipt(session, document_id, operation_id)
    inverse = receipt.get("inverseOperations") or []
    if not inverse:
        raise HTTPException(409, "Operation has no inverse; cannot undo.")
    snapshot = await load_document_snapshot(session, document_id)
    return await execute_operation(
        session,
        document_id=document_id,
        base_revision=snapshot["revision"],
        operations=inverse,
        operation_id=str(uuid.uuid4()),
        actor_source="undo",
        idempotency_key=f"undo:{operation_id}",
    )


async def persist_generated_slides(
    session: AsyncSession,
    document_id,
    generated_slides,
    *,
    extra_objects=None,
    actor_source: str = "ai",
    operation_id=None,
) -> dict:
    if extra_objects:
        session.add_all(list(extra_objects))
        await session.flush()
    snapshot = await load_document_snapshot(session, document_id)
    operations = build_index_aligned_stream_operations(
        snapshot.get("slides") or [],
        generated_slides,
    )
    return await execute_operation(
        session,
        document_id=document_id,
        base_revision=snapshot["revision"],
        operations=operations,
        operation_id=operation_id or str(uuid.uuid4()),
        actor_source=actor_source,
    )
