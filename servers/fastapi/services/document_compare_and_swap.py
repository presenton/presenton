"""SQLite laboratory guard for manual full-deck/metadata writes.

Not a cross-database revision protocol. Other AI/stream writers are not covered.
"""
import uuid
from sqlalchemy import delete, text
from sqlmodel import select
from fastapi import HTTPException
from api.v1.auth.context import get_current_owner_id
from models.sql.presentation import PresentationModel
from models.sql.slide import SlideModel
from services.slide_compare_and_swap import MUTABLE_FIELDS
from constants.presentation import MAX_NUMBER_OF_SLIDES


def slide_value(slide):
    return {'id': str(slide.id), 'presentation': str(slide.presentation),
            'index': slide.index, **{key:getattr(slide,key) for key in MUTABLE_FIELDS}}


def snapshot(presentation, slides):
    return {'id':str(presentation.id), 'title':presentation.title,
            'theme':presentation.theme, 'n_slides':presentation.n_slides,
            'slides':[slide_value(s) for s in slides]}


def normalize_baseline(base):
    try:
        slides=[SlideModel.model_validate_json(__import__('json').dumps(s)) for s in base['slides']]
        return {'id':str(uuid.UUID(str(base['id']))), 'title':base.get('title'),
                'theme':base.get('theme'), 'n_slides':base['n_slides'],
                'slides':[slide_value(s) for s in slides]}
    except Exception as exc:
        raise HTTPException(422,'Invalid saved document baseline.') from exc


async def save_document_if_unchanged(session, presentation_id, baseline, changes):
    if baseline is None:
        raise HTTPException(428,'A saved document baseline is required. No changes were saved.')
    if session.bind.dialect.name != 'sqlite':
        raise HTTPException(501,'This laboratory document guard supports SQLite only.')
    # Must precede reads in this request session. Serializes validation + all
    # writes including deletes/inserts. Rollback covers failure at any point.
    try:
        await session.execute(text('BEGIN IMMEDIATE'))
        owner=get_current_owner_id()
        presentation=await session.get(PresentationModel,presentation_id)
        if presentation is None or presentation.owner_id != owner:
            raise HTTPException(404,'Presentation not found.')
        slides=list((await session.scalars(select(SlideModel).where(
            SlideModel.presentation==presentation_id, SlideModel.owner_id==owner
        ).order_by(SlideModel.index))).all())
        saved=snapshot(presentation,slides)
        base=normalize_baseline(baseline)
        if base['id'] != str(presentation_id):
            raise HTTPException(422,'Baseline identifies a different presentation.')
        desired={**saved}
        for key in ('title','theme'):
            if key in changes: desired[key]=changes[key]
        incoming=None
        if 'slides' in changes:
            if not isinstance(changes['slides'],list) or not 1<=len(changes['slides'])<=MAX_NUMBER_OF_SLIDES:
                raise HTTPException(422,'Slides must be a nonempty bounded list.')
            incoming=[]; ids=set()
            for index,payload in enumerate(changes['slides']):
                try:
                    slide=SlideModel.model_validate_json(__import__('json').dumps(payload))
                    sid=uuid.UUID(str(slide.id));pid=uuid.UUID(str(slide.presentation))
                except Exception as exc:raise HTTPException(422,'Invalid slide.') from exc
                if sid in ids or pid!=presentation_id or slide.index!=index:
                    raise HTTPException(422,'Duplicate ID, mismatched presentation, or invalid order.')
                # Do not allow stealing or deleting another document's slide.
                collision=await session.scalar(select(SlideModel).where(SlideModel.id==sid).execution_options(skip_owner_scope=True))
                if collision is not None and (collision.presentation!=presentation_id or collision.owner_id!=owner):
                    raise HTTPException(409,'Slide ID is unavailable.')
                ids.add(sid);slide.id=sid;slide.presentation=pid;slide.owner_id=owner
                incoming.append(slide)
            desired['slides']=[slide_value(s) for s in incoming]
            desired['n_slides']=len(incoming)
        if 'n_slides' in changes and changes['n_slides']!=desired['n_slides']:
            raise HTTPException(422,'Slide count must match the saved slide array.')
        # Safe no-op even if a response to the first attempt was lost.
        if desired == saved:
            await session.commit()
            return presentation,slides
        if base != saved:
            raise HTTPException(409,'Presentation changed elsewhere. Your local changes are not saved. Keep a copy before reloading.')
        for key in ('title','theme','n_slides'):setattr(presentation,key,desired[key])
        if incoming is not None:
            # Remove old ORM identities before inserting retained IDs.
            for old in slides:session.expunge(old)
            await session.execute(delete(SlideModel).where(
                SlideModel.presentation==presentation_id,SlideModel.owner_id==owner
            ).execution_options(synchronize_session=False))
            session.add_all(incoming)
        session.add(presentation)
        await session.commit()
        return presentation,incoming if incoming is not None else slides
    except Exception:
        await session.rollback()
        raise
