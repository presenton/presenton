import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from models.sql.operation import OperationState
from services.operation_executor import (
    document_snapshot,
    operation_request_hash,
    _get_owned_document,
)


class ProposalStore:
    """In-memory proposal store for the laboratory; replace with SQL table for production."""

    def __init__(self):
        self._proposals = {}

    def _key(self, document_id, proposal_id):
        return (str(document_id), str(proposal_id))

    async def create(self, document_id, base_revision, operations, proposal_id=None) -> dict:
        proposal_id = proposal_id or str(uuid.uuid4())
        proposal = {
            "id": proposal_id,
            "documentId": str(document_id),
            "baseRevision": base_revision,
            "operations": operations,
            "status": "ready",
            "payloadHash": operation_request_hash(
                {
                    "document_id": str(document_id),
                    "base_revision": base_revision,
                    "operations": operations,
                    "proposal_id": proposal_id,
                    "actor_source": "ai",
                }
            ),
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        self._proposals[self._key(document_id, proposal_id)] = proposal
        return proposal

    async def get(self, document_id, proposal_id) -> Optional[dict]:
        return self._proposals.get(self._key(document_id, proposal_id))

    async def list_for_document(self, document_id) -> list[dict]:
        return [
            proposal
            for (doc_id, _), proposal in self._proposals.items()
            if doc_id == str(document_id)
        ]

    async def mark_status(self, document_id, proposal_id, status) -> dict:
        proposal = await self.get(document_id, proposal_id)
        if proposal is None:
            raise HTTPException(404, "Proposal not found.")
        proposal["status"] = status
        return proposal


PROPOSAL_STORE = ProposalStore()


async def load_proposal(session: AsyncSession, document_id, proposal_id) -> Optional[dict]:
    proposal = await PROPOSAL_STORE.get(document_id, proposal_id)
    if proposal is None:
        return None
    presentation = await _get_owned_document(session, uuid.UUID(str(document_id)))
    from models.sql.slide import SlideModel
    slides = list(
        (
            await session.scalars(
                select(SlideModel)
                .where(SlideModel.presentation == document_id)
                .order_by(SlideModel.index)
            )
        ).all()
    )
    current = document_snapshot(presentation, slides)
    if proposal["baseRevision"] != current["revision"]:
        return await PROPOSAL_STORE.mark_status(document_id, proposal_id, "stale")
    return proposal
