import asyncio
import tempfile
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from models.sql.outbox import DocumentJobModel
from models.sql.presentation import PresentationModel, PresentationVersion
from services.outbox import claim_next, complete, enqueue, heartbeat


class OutboxLeaseTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.engine = create_async_engine(
            "sqlite+aiosqlite:///" + str(Path(self.temp.name) / "jobs.db")
        )
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        self.document_id = uuid.uuid4()
        async with self.sessions() as session:
            session.add(
                PresentationModel(
                    id=self.document_id,
                    owner_id=uuid.uuid4(),
                    version=PresentationVersion.V2_STANDARD,
                    content="",
                    n_slides=1,
                    language="Russian",
                    title="Jobs",
                    revision=1,
                )
            )
            await session.commit()

    async def asyncTearDown(self):
        await self.engine.dispose()
        self.temp.cleanup()

    async def test_claim_heartbeat_and_complete(self):
        async with self.sessions() as session:
            job = await enqueue(session, self.document_id, "image", {"path": "x"})
            claimed = await claim_next(session, "worker-a", kind="image")
            self.assertEqual(claimed["id"], job["id"])
            self.assertEqual(claimed["status"], "leased")
            self.assertIsNone(await claim_next(session, "worker-b", kind="image"))
            beat = await heartbeat(session, claimed["id"], "worker-a")
            self.assertEqual(beat["status"], "leased")
            done = await complete(session, claimed["id"], "worker-a")
            self.assertEqual(done["status"], "done")

    async def test_expired_lease_can_be_stolen(self):
        async with self.sessions() as session:
            await enqueue(session, self.document_id, "export", {})
            claimed = await claim_next(session, "worker-a", kind="export")
            row = await session.get(DocumentJobModel, uuid.UUID(claimed["id"]))
            row.lease_until = datetime.now(timezone.utc) - timedelta(seconds=1)
            session.add(row)
            await session.commit()
            stolen = await claim_next(session, "worker-b", kind="export")
            self.assertEqual(stolen["leaseOwner"], "worker-b")
            self.assertEqual(stolen["attempts"], 2)
            with self.assertRaises(HTTPException) as caught:
                await heartbeat(session, claimed["id"], "worker-a")
            self.assertEqual(caught.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main(verbosity=2)
