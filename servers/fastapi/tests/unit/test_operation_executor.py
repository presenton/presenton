import asyncio
import tempfile
import unittest
import uuid
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select

from models.sql.operation import OperationModel
from models.sql.presentation import PresentationModel, PresentationVersion
from models.sql.slide import SlideModel
from services.database import sql_engine as _registration
from services.operation_executor import execute_operation, get_operation_receipt, load_document_snapshot


class OperationExecutorTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.engine = create_async_engine(
            "sqlite+aiosqlite:///" + str(Path(self.temp.name) / "ops.db")
        )
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        self.document_id = uuid.uuid4()
        self.owner_id = uuid.uuid4()
        self.presentation = PresentationModel(
            id=self.document_id,
            owner_id=self.owner_id,
            version=PresentationVersion.V2_STANDARD,
            content="",
            n_slides=3,
            language="Russian",
            title="Operations",
            theme={"color": "blue"},
            revision=7,
        )
        self.slides = [
            SlideModel(
                id=uuid.uuid4(),
                presentation=self.document_id,
                owner_id=self.owner_id,
                index=i,
                layout_group="blank",
                layout="blank",
                content={"title": str(i)},
                properties=None,
                ui={"title": f"Slide {i}"},
            )
            for i in range(3)
        ]
        async with self.sessions() as session:
            session.add(self.presentation)
            session.add_all(self.slides)
            await session.commit()

    async def asyncTearDown(self):
        await self.engine.dispose()
        self.temp.cleanup()

    async def current_revision(self):
        async with self.sessions() as session:
            snapshot = await load_document_snapshot(session, self.document_id)
            return snapshot["revision"]

    async def test_two_operations_on_same_base_revision_second_conflicts(self):
        async with self.sessions() as session:
            first = await execute_operation(
                session,
                document_id=self.document_id,
                base_revision=7,
                operations=[
                    {
                        "scope": "document",
                        "targetIds": [],
                        "operationType": "UpdateMetadata",
                        "payload": {"title": "A"},
                    }
                ],
                operation_id=str(uuid.uuid4()),
            )
        self.assertEqual(first["resultingRevision"], 8)
        async with self.sessions() as session:
            with self.assertRaises(HTTPException) as caught:
                await execute_operation(
                    session,
                    document_id=self.document_id,
                    base_revision=7,
                    operations=[
                        {
                            "scope": "document",
                            "targetIds": [],
                            "operationType": "UpdateMetadata",
                            "payload": {"title": "B"},
                        }
                    ],
                    operation_id=str(uuid.uuid4()),
                )
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(await self.current_revision(), 8)

    async def test_same_operation_id_twice_returns_duplicate_without_second_commit(self):
        operation_id = str(uuid.uuid4())
        payload = {
            "scope": "document",
            "targetIds": [],
            "operationType": "UpdateMetadata",
            "payload": {"title": "Stable"},
        }
        async with self.sessions() as session:
            first = await execute_operation(
                session,
                document_id=self.document_id,
                base_revision=7,
                operations=[payload],
                operation_id=operation_id,
            )
        async with self.sessions() as session:
            duplicate = await execute_operation(
                session,
                document_id=self.document_id,
                base_revision=7,
                operations=[payload],
                operation_id=operation_id,
            )
        self.assertEqual(first["status"], "applied")
        self.assertEqual(duplicate["status"], "duplicate")
        self.assertEqual(first["resultingRevision"], duplicate["resultingRevision"])
        self.assertEqual(await self.current_revision(), 8)

    async def test_same_operation_id_with_different_payload_is_rejected(self):
        operation_id = str(uuid.uuid4())
        base_ops = [
            {
                "scope": "document",
                "targetIds": [],
                "operationType": "UpdateMetadata",
                "payload": {"title": "A"},
            }
        ]
        changed_ops = [
            {
                "scope": "document",
                "targetIds": [],
                "operationType": "UpdateMetadata",
                "payload": {"title": "B"},
            }
        ]
        async with self.sessions() as session:
            await execute_operation(
                session,
                document_id=self.document_id,
                base_revision=7,
                operations=base_ops,
                operation_id=operation_id,
            )
        async with self.sessions() as session:
            with self.assertRaises(HTTPException) as caught:
                await execute_operation(
                    session,
                    document_id=self.document_id,
                    base_revision=8,
                    operations=changed_ops,
                    operation_id=operation_id,
                )
        self.assertEqual(caught.exception.status_code, 409)
        self.assertIn("IDEMPOTENCY_CONFLICT", str(caught.exception.detail))

    async def test_missing_base_revision_is_rejected(self):
        async with self.sessions() as session:
            with self.assertRaises(HTTPException) as caught:
                await execute_operation(
                    session,
                    document_id=self.document_id,
                    base_revision=None,
                    operations=[
                        {
                            "scope": "document",
                            "targetIds": [],
                            "operationType": "UpdateMetadata",
                            "payload": {"title": "No baseline"},
                        }
                    ],
                )
        self.assertEqual(caught.exception.status_code, 428)
        self.assertEqual(await self.current_revision(), 7)

    async def test_operation_receipt_round_trip(self):
        operation_id = str(uuid.uuid4())
        async with self.sessions() as session:
            result = await execute_operation(
                session,
                document_id=self.document_id,
                base_revision=7,
                operations=[
                    {
                        "scope": "document",
                        "targetIds": [],
                        "operationType": "UpdateMetadata",
                        "payload": {"title": "Receipt"},
                    }
                ],
                operation_id=operation_id,
            )
        async with self.sessions() as session:
            receipt = await get_operation_receipt(session, self.document_id, operation_id)
        self.assertEqual(receipt["operationId"], operation_id)
        self.assertEqual(receipt["resultingRevision"], result["resultingRevision"])
        self.assertEqual(receipt["status"], "applied")

    async def test_insert_duplicate_move_delete_slide_operations(self):
        first_slide_id = str(self.slides[0].id)
        second_slide_id = str(self.slides[1].id)
        async with self.sessions() as session:
            await execute_operation(
                session,
                document_id=self.document_id,
                base_revision=7,
                operations=[
                    {
                        "scope": "slide",
                        "targetIds": [first_slide_id],
                        "operationType": "DuplicateSlide",
                        "payload": {},
                    },
                    {
                        "scope": "slide",
                        "targetIds": [second_slide_id],
                        "operationType": "MoveSlide",
                        "payload": {"insertAfterId": first_slide_id},
                    },
                ],
                operation_id=str(uuid.uuid4()),
            )
        async with self.sessions() as session:
            snapshot = await load_document_snapshot(session, self.document_id)
        self.assertEqual(len(snapshot["slides"]), 4)
        self.assertEqual(snapshot["revision"], 8)
        order = [slide["id"] for slide in snapshot["slides"]]
        self.assertEqual(order.index(second_slide_id), order.index(first_slide_id) + 1)

        duplicated_id = next(
            slide["id"] for slide in snapshot["slides"] if slide["id"] != first_slide_id and slide["id"] != second_slide_id and slide["id"] != str(self.slides[2].id)
        )
        async with self.sessions() as session:
            await execute_operation(
                session,
                document_id=self.document_id,
                base_revision=8,
                operations=[
                    {
                        "scope": "slide",
                        "targetIds": [duplicated_id],
                        "operationType": "DeleteSlide",
                        "payload": {},
                    }
                ],
                operation_id=str(uuid.uuid4()),
            )
        async with self.sessions() as session:
            snapshot = await load_document_snapshot(session, self.document_id)
        self.assertEqual(len(snapshot["slides"]), 3)
        self.assertEqual(snapshot["revision"], 9)


if __name__ == "__main__":
    unittest.main(verbosity=2)
