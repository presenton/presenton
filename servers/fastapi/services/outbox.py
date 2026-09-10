"""SQLite outbox with worker leases. Not a distributed queue."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from models.sql.outbox import DocumentJobModel


LEASE_SECONDS = 30


def _now():
    return datetime.now(timezone.utc)


def _dump(row: DocumentJobModel) -> dict:
    return {
        "id": str(row.id),
        "documentId": str(row.document_id) if row.document_id else None,
        "kind": row.kind,
        "status": row.status,
        "payload": row.payload or {},
        "leaseOwner": row.lease_owner,
        "leaseUntil": row.lease_until.isoformat() if row.lease_until else None,
        "attempts": row.attempts,
    }


async def enqueue(session: AsyncSession, document_id, kind: str, payload: Optional[dict] = None) -> dict:
    row = DocumentJobModel(
        document_id=uuid.UUID(str(document_id)) if document_id else None,
        kind=kind,
        status="pending",
        payload=payload or {},
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _dump(row)


async def claim_next(session: AsyncSession, worker_id: str, kind: Optional[str] = None) -> Optional[dict]:
    now = _now()
    query = select(DocumentJobModel).where(
        (DocumentJobModel.status == "pending")
        | (
            (DocumentJobModel.status == "leased")
            & (DocumentJobModel.lease_until != None)
            & (DocumentJobModel.lease_until < now)
        )
    )
    if kind:
        query = query.where(DocumentJobModel.kind == kind)
    query = query.order_by(DocumentJobModel.created_at)
    row = (await session.scalars(query)).first()
    if row is None:
        return None
    row.status = "leased"
    row.lease_owner = worker_id
    row.lease_until = now + timedelta(seconds=LEASE_SECONDS)
    row.attempts = int(row.attempts or 0) + 1
    row.updated_at = now
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _dump(row)


async def heartbeat(session: AsyncSession, job_id, worker_id: str) -> dict:
    row = await session.get(DocumentJobModel, uuid.UUID(str(job_id)))
    if row is None:
        raise HTTPException(404, "Job not found.")
    if row.lease_owner != worker_id or row.status != "leased":
        raise HTTPException(409, "LEASE_LOST")
    row.lease_until = _now() + timedelta(seconds=LEASE_SECONDS)
    row.updated_at = _now()
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _dump(row)


async def complete(session: AsyncSession, job_id, worker_id: str, status: str = "done") -> dict:
    row = await session.get(DocumentJobModel, uuid.UUID(str(job_id)))
    if row is None:
        raise HTTPException(404, "Job not found.")
    if row.lease_owner != worker_id:
        raise HTTPException(409, "LEASE_LOST")
    row.status = status
    row.lease_until = None
    row.updated_at = _now()
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _dump(row)
