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
from services.operation_executor import (
    build_index_aligned_stream_operations,
    execute_operation,
    get_operation_receipt,
    invert_operations,
    load_document_snapshot,
    persist_generated_slides,
    undo_operation,
)


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



    async def test_insert_slide_keeps_client_id_and_move_to_front(self):
        new_id = str(uuid.uuid4())
        first_slide_id = str(self.slides[0].id)
        async with self.sessions() as session:
            inserted = await execute_operation(
                session,
                document_id=self.document_id,
                base_revision=7,
                operations=[
                    {
                        "scope": "document",
                        "targetIds": [],
                        "operationType": "InsertSlide",
                        "payload": {
                            "id": new_id,
                            "index": 0,
                            "layout_group": "blank",
                            "layout": "__blank_slide__",
                            "content": {"k": "v"},
                            "speaker_note": "front",
                        },
                    }
                ],
                operation_id=str(uuid.uuid4()),
            )
            self.assertEqual(inserted["status"], "applied")
            snapshot = await load_document_snapshot(session, self.document_id)
            self.assertEqual(snapshot["slides"][0]["id"], new_id)
            self.assertEqual(snapshot["slides"][0]["speaker_note"], "front")
            moved = await execute_operation(
                session,
                document_id=self.document_id,
                base_revision=snapshot["revision"],
                operations=[
                    {
                        "scope": "slide",
                        "targetIds": [first_slide_id],
                        "operationType": "MoveSlide",
                        "payload": {"index": 0},
                    }
                ],
                operation_id=str(uuid.uuid4()),
            )
            self.assertEqual(moved["status"], "applied")
            after = await load_document_snapshot(session, self.document_id)
            self.assertEqual(after["slides"][0]["id"], first_slide_id)

    def test_index_aligned_helper_updates_existing_ids_instead_of_delete_all(self):
        existing_ids = [str(uuid.uuid4()) for _ in range(3)]
        generated_ids = [str(uuid.uuid4()) for _ in range(3)]
        existing = [
            {
                "id": existing_ids[i],
                "index": i,
                "layout_group": "blank",
                "layout": "blank",
                "content": {"title": str(i)},
                "html_content": None,
                "speaker_note": "",
                "properties": None,
                "ui": None,
            }
            for i in range(3)
        ]
        generated = [
            {
                "id": generated_ids[i],
                "index": i,
                "layout_group": "swift",
                "layout": "title",
                "content": {"title": f"new-{i}"},
                "html_content": None,
                "speaker_note": "note",
                "properties": None,
                "ui": {"k": i},
            }
            for i in range(3)
        ]
        operations = build_index_aligned_stream_operations(existing, generated)
        self.assertEqual([op["operationType"] for op in operations], ["UpdateSlide"] * 3)
        self.assertEqual([op["targetIds"][0] for op in operations], existing_ids)
        self.assertNotIn("DeleteSlide", [op["operationType"] for op in operations])
        self.assertNotIn("InsertSlide", [op["operationType"] for op in operations])
        self.assertEqual(operations[0]["payload"]["content"], {"title": "new-0"})

    def test_index_aligned_helper_grows_and_shrinks_by_index(self):
        existing_ids = [str(uuid.uuid4()) for _ in range(2)]
        extra_id = str(uuid.uuid4())
        generated_ids = [str(uuid.uuid4()) for _ in range(3)]
        existing = [
            {
                "id": slide_id,
                "index": i,
                "layout_group": "blank",
                "layout": "blank",
                "content": {},
                "html_content": None,
                "speaker_note": "",
                "properties": None,
                "ui": None,
            }
            for i, slide_id in enumerate(existing_ids)
        ]
        generated = [
            {
                "id": slide_id,
                "index": i,
                "layout_group": "blank",
                "layout": "blank",
                "content": {"n": i},
                "html_content": None,
                "speaker_note": "",
                "properties": None,
                "ui": None,
            }
            for i, slide_id in enumerate(generated_ids)
        ]
        grown = build_index_aligned_stream_operations(existing, generated)
        self.assertEqual(
            [op["operationType"] for op in grown],
            ["UpdateSlide", "UpdateSlide", "InsertSlide"],
        )
        self.assertEqual(grown[2]["payload"]["id"], generated_ids[2])
        shrunk = build_index_aligned_stream_operations(
            existing
            + [
                {
                    "id": extra_id,
                    "index": 2,
                    "layout_group": "blank",
                    "layout": "blank",
                    "content": {},
                    "html_content": None,
                    "speaker_note": "",
                    "properties": None,
                    "ui": None,
                }
            ],
            generated[:1],
        )
        self.assertEqual(
            [op["operationType"] for op in shrunk],
            ["UpdateSlide", "DeleteSlide", "DeleteSlide"],
        )
        self.assertEqual(shrunk[0]["targetIds"], [existing_ids[0]])
        self.assertEqual(shrunk[1]["targetIds"], [existing_ids[1]])
        self.assertEqual(shrunk[2]["targetIds"], [extra_id])

    def test_index_aligned_helper_first_generation_inserts_only(self):
        generated_ids = [str(uuid.uuid4()), str(uuid.uuid4())]
        generated = [
            {
                "id": slide_id,
                "index": i,
                "layout_group": "blank",
                "layout": "blank",
                "content": {"n": i},
                "html_content": None,
                "speaker_note": "",
                "properties": None,
                "ui": None,
            }
            for i, slide_id in enumerate(generated_ids)
        ]
        operations = build_index_aligned_stream_operations([], generated)
        self.assertEqual(
            [op["operationType"] for op in operations], ["InsertSlide", "InsertSlide"]
        )
        self.assertEqual([op["payload"]["id"] for op in operations], generated_ids)

    def test_index_aligned_helper_rejects_empty_generated(self):
        with self.assertRaises(HTTPException) as raised:
            build_index_aligned_stream_operations(
                [{"id": str(uuid.uuid4()), "index": 0}], []
            )
        self.assertEqual(raised.exception.status_code, 422)

    async def test_persist_generated_slides_keeps_existing_uuids_and_bumps_revision(self):
        existing_ids = [str(slide.id) for slide in self.slides]
        generated = [
            SlideModel(
                id=uuid.uuid4(),
                presentation=self.document_id,
                owner_id=self.owner_id,
                index=i,
                layout_group="swift",
                layout="title",
                content={"title": f"stream-{i}"},
                properties=None,
                speaker_note=f"note-{i}",
                ui={"i": i},
            )
            for i in range(3)
        ]
        async with self.sessions() as session:
            result = await persist_generated_slides(
                session,
                self.document_id,
                generated,
                actor_source="ai",
            )
            self.assertEqual(result["status"], "applied")
            self.assertEqual(result["previousRevision"], 7)
            self.assertEqual(result["resultingRevision"], 8)
            snapshot = await load_document_snapshot(session, self.document_id)
            self.assertEqual([slide["id"] for slide in snapshot["slides"]], existing_ids)
            self.assertEqual(snapshot["revision"], 8)
            self.assertEqual(snapshot["n_slides"], 3)
            self.assertEqual(snapshot["slides"][1]["content"], {"title": "stream-1"})
            self.assertEqual(snapshot["slides"][1]["speaker_note"], "note-1")
            self.assertEqual(snapshot["slides"][1]["layout_group"], "swift")
            stored = list(
                (
                    await session.scalars(
                        select(OperationModel).where(
                            OperationModel.document_id == self.document_id
                        )
                    )
                ).all()
            )
            self.assertEqual(len(stored), 1)
            self.assertEqual(stored[0].actor_source, "ai")

    async def test_persist_generated_slides_first_deck_inserts_without_delete(self):
        empty_id = uuid.uuid4()
        generated_ids = [uuid.uuid4(), uuid.uuid4()]
        async with self.sessions() as session:
            session.add(
                PresentationModel(
                    id=empty_id,
                    owner_id=self.owner_id,
                    version=PresentationVersion.V2_STANDARD,
                    content="",
                    n_slides=2,
                    language="Russian",
                    title="Empty",
                    revision=1,
                )
            )
            await session.commit()
            generated = [
                SlideModel(
                    id=generated_ids[i],
                    presentation=empty_id,
                    owner_id=self.owner_id,
                    index=i,
                    layout_group="blank",
                    layout="blank",
                    content={"title": str(i)},
                    properties=None,
                    speaker_note="",
                    ui=None,
                )
                for i in range(2)
            ]
            result = await persist_generated_slides(
                session, empty_id, generated, actor_source="ai"
            )
            self.assertEqual(result["status"], "applied")
            snapshot = await load_document_snapshot(session, empty_id)
            self.assertEqual(
                [slide["id"] for slide in snapshot["slides"]],
                [str(value) for value in generated_ids],
            )
            self.assertEqual(snapshot["revision"], 2)

    async def test_undo_restores_slide_content_and_bumps_revision(self):
        slide_id = str(self.slides[0].id)
        async with self.sessions() as session:
            applied = await execute_operation(
                session,
                document_id=self.document_id,
                base_revision=7,
                operations=[
                    {
                        "scope": "slide",
                        "targetIds": [slide_id],
                        "operationType": "UpdateSlide",
                        "payload": {"content": {"title": "mutated"}},
                    }
                ],
                operation_id=str(uuid.uuid4()),
            )
        self.assertEqual(applied["resultingRevision"], 8)
        self.assertTrue(applied["receipt"]["inverseOperations"])
        async with self.sessions() as session:
            snapshot = await load_document_snapshot(session, self.document_id)
            self.assertEqual(snapshot["slides"][0]["content"]["title"], "mutated")
            undone = await undo_operation(session, self.document_id, applied["operationId"])
        self.assertEqual(undone["status"], "applied")
        async with self.sessions() as session:
            snapshot = await load_document_snapshot(session, self.document_id)
            self.assertEqual(snapshot["slides"][0]["content"]["title"], "0")
            self.assertEqual(snapshot["slides"][0]["id"], slide_id)
            self.assertEqual(snapshot["revision"], 9)

    async def test_invert_insert_is_delete(self):
        before = {
            "title": "Operations",
            "theme": {"color": "blue"},
            "slides": [{"id": "a", "index": 0, "content": {}}],
        }
        ops = [
            {
                "scope": "document",
                "targetIds": [],
                "operationType": "InsertSlide",
                "payload": {"id": "b", "index": 1, "content": {"t": 1}},
            }
        ]
        inverse = invert_operations(ops, before)
        self.assertEqual(inverse[0]["operationType"], "DeleteSlide")
        self.assertEqual(inverse[0]["targetIds"], ["b"])



    async def test_snapshot_exposes_last_operation_id(self):
        async with self.sessions() as session:
            applied = await execute_operation(
                session,
                document_id=self.document_id,
                base_revision=7,
                operations=[{
                    "scope": "document",
                    "targetIds": [],
                    "operationType": "UpdateMetadata",
                    "payload": {"title": "Snap"},
                }],
                operation_id=str(uuid.uuid4()),
            )
            snapshot = await load_document_snapshot(session, self.document_id)
        self.assertEqual(snapshot["lastOperationId"], applied["operationId"])
        self.assertEqual(snapshot["title"], "Snap")



if __name__ == "__main__":
    unittest.main(verbosity=2)
