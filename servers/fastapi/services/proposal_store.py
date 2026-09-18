import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from models.sql.proposal import ProposalModel
from models.sql.slide import SlideModel
from services.operation_executor import (
    operation_request_hash,
    _get_owned_document,
)


def _dump(row: ProposalModel) -> dict:
    return {
        "id": str(row.id),
        "documentId": str(row.document_id),
        "baseRevision": row.base_revision,
        "operations": row.operations or [],
        "status": row.status,
        "payloadHash": row.payload_hash,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


class ProposalStore:
    async def create(self, session: AsyncSession, document_id, base_revision, operations, proposal_id=None) -> dict:
        proposal_id = uuid.UUID(str(proposal_id)) if proposal_id else uuid.uuid4()
        payload_hash = operation_request_hash(
            {
                "document_id": str(document_id),
                "base_revision": base_revision,
                "operations": operations,
                "proposal_id": str(proposal_id),
                "actor_source": "ai",
            }
        )
        row = ProposalModel(
            id=proposal_id,
            document_id=uuid.UUID(str(document_id)),
            base_revision=int(base_revision or 0),
            operations=operations,
            status="ready",
            payload_hash=payload_hash,
            created_at=datetime.now(timezone.utc),
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return _dump(row)

    async def get(self, session: AsyncSession, document_id, proposal_id) -> Optional[dict]:
        row = await session.get(ProposalModel, uuid.UUID(str(proposal_id)))
        if row is None or str(row.document_id) != str(document_id):
            return None
        return _dump(row)

    async def mark_status(self, session: AsyncSession, document_id, proposal_id, status) -> dict:
        row = await session.get(ProposalModel, uuid.UUID(str(proposal_id)))
        if row is None or str(row.document_id) != str(document_id):
            raise HTTPException(404, "Proposal not found.")
        row.status = status
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return _dump(row)


PROPOSAL_STORE = ProposalStore()


async def load_proposal(session: AsyncSession, document_id, proposal_id) -> Optional[dict]:
    proposal = await PROPOSAL_STORE.get(session, document_id, proposal_id)
    if proposal is None:
        return None
    presentation = await _get_owned_document(session, uuid.UUID(str(document_id)))
    slides = list(
        (
            await session.scalars(
                select(SlideModel)
                .where(SlideModel.presentation == document_id)
                .order_by(SlideModel.index)
            )
        ).all()
    )
    if int(getattr(presentation, "revision", 0) or 0) != int(proposal["baseRevision"]):
        return await PROPOSAL_STORE.mark_status(session, document_id, proposal_id, "stale")
    return proposal
