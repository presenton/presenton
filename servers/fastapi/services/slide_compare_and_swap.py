"""Guarded single-slide writes; no blind fallback for stale or legacy clients.

This protects this endpoint only. Other deck/AI writers need their own guarded
operation contract before the application can claim document-wide concurrency.
"""
import uuid
from fastapi import HTTPException
from sqlalchemy import update, JSON, or_
from models.sql.slide import SlideModel

MUTABLE_FIELDS = (
    'layout_group', 'layout', 'content', 'html_content', 'speaker_note',
    'properties', 'ui',
)


def mutable_values(slide):
    return {key: getattr(slide, key) for key in MUTABLE_FIELDS}


async def save_slide_if_unchanged(session, incoming, baseline):
    if baseline is None:
        raise HTTPException(428, 'A saved baseline is required. Reload before editing.')
    try:
        sid = uuid.UUID(str(incoming.id))
        pid = uuid.UUID(str(incoming.presentation))
        if uuid.UUID(str(baseline.id)) != sid or uuid.UUID(str(baseline.presentation)) != pid:
            raise HTTPException(422, 'Baseline must identify the same slide and presentation.')
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(422, 'Invalid slide or presentation ID.') from exc

    # ORM SELECT retains the existing request owner scoping.
    stored = await session.get(SlideModel, sid)
    if stored is None:
        raise HTTPException(404, 'Slide not found.')
    if stored.presentation != pid:
        raise HTTPException(400, 'Slide does not belong to the supplied presentation.')
    current, desired = mutable_values(stored), mutable_values(incoming)
    if current == desired:
        return stored  # Retry after an acknowledged/lost response is a no-op.
    if current != mutable_values(baseline):
        raise HTTPException(409, 'Slide changed elsewhere. Your local edit is not saved. Keep a copy before reloading.')

    # The comparison and write must be one SQL statement, not SELECT + blind
    # ORM commit. Explicit owner and presentation predicates also cover DML,
    # which the existing SELECT-only tenant hook does not scope.
    predicates = [SlideModel.id == sid, SlideModel.presentation == pid,
                  SlideModel.owner_id == stored.owner_id]
    for key, value in current.items():
        column = getattr(SlideModel, key)
        if value is None:
            # SQL NULL and JSON null deserialize alike; allow either storage.
            predicates.append(or_(column.is_(None), column == JSON.NULL)
                              if key in ('content', 'properties', 'ui') else column.is_(None))
        else:
            predicates.append(column == value)
    result = await session.execute(
        update(SlideModel).where(*predicates).values(**desired)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        await session.rollback()
        raise HTTPException(409, 'Slide changed while saving. Your local edit is not saved.')
    await session.commit()
    await session.refresh(stored)
    return stored
