import tempfile
import unittest
import uuid
from pathlib import Path

from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from api.main import app
from services.database import get_async_session
from models.sql.presentation import PresentationModel, PresentationVersion
from models.sql.slide import SlideModel
from services.database import sql_engine as _registration


class EditorApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        engine = create_async_engine("sqlite+aiosqlite:///" + str(Path(self.temp.name) / "editor.db"))
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        self._session_factory = self._session_override(engine)
        app.dependency_overrides[get_async_session] = self._make_session_override()
        self.owner_id = uuid.uuid4()
        self.document_id = uuid.uuid4()
        self.presentation = PresentationModel(
            id=self.document_id,
            owner_id=self.owner_id,
            version=PresentationVersion.V2_STANDARD,
            content="",
            n_slides=2,
            language="Russian",
            title="Editor API",
            theme=None,
            revision=11,
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
            for i in range(2)
        ]
        async with self._session_factory() as session:
            session.add(self.presentation)
            session.add_all(self.slides)
            await session.commit()
        # Laboratory-only: run with auth-disabled runtime and explicit owner context.
        # That is the same execution path used by the Electron/local runtime.
        import api.middlewares as middlewares
        self._original_disable_auth = middlewares.is_disable_auth_enabled
        middlewares.is_disable_auth_enabled = lambda: True
        from api.v1.auth.context import set_current_owner_id
        self._owner_token = set_current_owner_id(self.owner_id)
        self.client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()
        app.dependency_overrides.clear()
        import api.middlewares as middlewares
        from api.v1.auth.context import reset_current_owner_id
        middlewares.is_disable_auth_enabled = self._original_disable_auth
        reset_current_owner_id(self._owner_token)
        self.temp.cleanup()

    def _session_override(self, engine):
        return async_sessionmaker(engine, expire_on_commit=False)

    def _make_session_override(self):
        async def override():
            async with self._session_factory() as session:
                yield session

        return override


    async def test_snapshot_returns_revision_and_slides(self):
        response = await self.client.get(f"/api/v1/ppt/editor/v1/documents/{self.document_id}/snapshot")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["revision"], 11)
        self.assertEqual(len(payload["slides"]), 2)

    async def test_operation_endpoint_applies_and_returns_receipt(self):
        response = await self.client.post(
            f"/api/v1/ppt/editor/v1/documents/{self.document_id}/operations",
            json={
                "baseRevision": 11,
                "operations": [
                    {
                        "scope": "document",
                        "targetIds": [],
                        "operationType": "UpdateMetadata",
                        "payload": {"title": "Updated"},
                    }
                ],
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["resultingRevision"], 12)

        receipt_response = await self.client.get(
            f"/api/v1/ppt/editor/v1/documents/{self.document_id}/operations/{payload['operationId']}"
        )
        self.assertEqual(receipt_response.status_code, 200)
        receipt = receipt_response.json()
        self.assertEqual(receipt["status"], "applied")
        self.assertEqual(receipt["resultingRevision"], 12)


if __name__ == "__main__":
    unittest.main(verbosity=2)
