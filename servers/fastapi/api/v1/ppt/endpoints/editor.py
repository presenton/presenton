import uuid
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from services.database import get_async_session
from services.operation_executor import (
    execute_operation,
    get_operation_receipt,
    load_document_snapshot,
)
from services.proposal_store import PROPOSAL_STORE, load_proposal

EDITOR_ROUTER = APIRouter(prefix="/editor/v1/documents", tags=["Editor Operations"])


class EditorOperationRequest(BaseModel):
    operationId: Optional[str] = None
    baseRevision: Optional[int] = None
    scope: str = "document"
    targetIds: Optional[list[str]] = None
    operationType: str
    payload: dict[str, Any]


class EditorBatchRequest(BaseModel):
    operationId: Optional[str] = None
    baseRevision: Optional[int] = None
    proposalId: Optional[str] = None
    operations: list[EditorOperationRequest]


class ApplyProposalRequest(BaseModel):
    operationId: Optional[str] = None
    baseRevision: Optional[int] = None


@EDITOR_ROUTER.get("/{document_id}/snapshot")
async def get_document_snapshot(
    document_id: uuid.UUID,
    sql_session: AsyncSession = Depends(get_async_session),
):
    return await load_document_snapshot(sql_session, document_id)


@EDITOR_ROUTER.post("/{document_id}/proposals")
async def create_document_proposal(
    document_id: uuid.UUID,
    request: EditorBatchRequest,
    sql_session: AsyncSession = Depends(get_async_session),
):
    return await PROPOSAL_STORE.create(
        document_id,
        request.baseRevision,
        [op.model_dump() for op in request.operations],
        request.proposalId,
    )


@EDITOR_ROUTER.post("/{document_id}/operations")
async def submit_document_operations(
    document_id: uuid.UUID,
    request: EditorBatchRequest,
    sql_session: AsyncSession = Depends(get_async_session),
):
    return await execute_operation(
        sql_session,
        document_id=document_id,
        base_revision=request.baseRevision,
        operations=[op.model_dump() for op in request.operations],
        operation_id=request.operationId,
        proposal_id=request.proposalId,
    )


@EDITOR_ROUTER.post("/{document_id}/proposals/{proposal_id}/apply")
async def apply_document_proposal(
    document_id: uuid.UUID,
    proposal_id: uuid.UUID,
    request: ApplyProposalRequest,
    sql_session: AsyncSession = Depends(get_async_session),
):
    from services.proposal_store import PROPOSAL_STORE, load_proposal

    proposal = await load_proposal(sql_session, document_id, proposal_id)
    if proposal is None:
        raise HTTPException(404, "Proposal not found.")
    if proposal["status"] != "ready":
        if proposal["status"] == "stale":
            raise HTTPException(409, "Proposal is stale. Regenerate it from the current document revision.")
        raise HTTPException(409, f"Proposal is not ready to apply: {proposal['status']}")
    if proposal["baseRevision"] != request.baseRevision:
        raise HTTPException(409, "REVISION_CONFLICT")
    return await execute_operation(
        sql_session,
        document_id=document_id,
        base_revision=request.baseRevision,
        operations=proposal["operations"],
        operation_id=request.operationId,
        proposal_id=str(proposal_id),
        actor_source="ai",
    )


@EDITOR_ROUTER.get("/{document_id}/operations/{operation_id}")
async def get_document_operation(
    document_id: uuid.UUID,
    operation_id: uuid.UUID,
    sql_session: AsyncSession = Depends(get_async_session),
):
    return await get_operation_receipt(sql_session, document_id, operation_id)
