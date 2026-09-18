"""Real SQLite tests for the guarded persistence contract (no fake rowcount)."""
import tempfile
import unittest
import uuid
from pathlib import Path
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel
from models.sql.slide import SlideModel
from services.database import sql_engine as _registered_models  # no connection
from services.slide_compare_and_swap import save_slide_if_unchanged


def clone(slide):
    return SlideModel.model_validate_json(slide.model_dump_json())


class SlideSaveTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.engine = create_async_engine('sqlite+aiosqlite:///' + str(Path(self.temp.name)/'test.db'))
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        self.base = SlideModel(id=uuid.uuid4(), presentation=uuid.uuid4(), index=2,
            layout_group='blank', layout='title', content={'title':'Original'},
            properties=None, ui={'title':'Original','body':'Original'})
        async with self.sessions() as s:
            s.add(self.base)
            await s.commit()

    async def asyncTearDown(self):
        await self.engine.dispose()
        self.temp.cleanup()

    async def attempt(self, incoming, baseline, code):
        async with self.sessions() as s:
            if code == 200:
                return await save_slide_if_unchanged(s, incoming, baseline)
            with self.assertRaises(HTTPException) as caught:
                await save_slide_if_unchanged(s, incoming, baseline)
            self.assertEqual(caught.exception.status_code, code)

    async def read(self):
        async with self.sessions() as s:
            return await s.get(SlideModel, self.base.id)

    async def test_mutable_fields_only_and_json_uuid_strings(self):
        incoming=clone(self.base)
        incoming.content={'title':'Updated'}
        incoming.ui={'title':'Updated','body':'Original'}
        incoming.index=99
        incoming.owner_id=uuid.uuid4()
        result=await self.attempt(incoming, clone(self.base), 200)
        self.assertEqual(result.content, incoming.content)
        self.assertEqual(result.index, 2)
        self.assertEqual(result.owner_id, self.base.owner_id)
        self.assertEqual(result.presentation, self.base.presentation)

    async def test_missing_baseline_rejected(self):
        await self.attempt(clone(self.base), None, 428)

    async def test_invalid_ids_rejected(self):
        incoming=clone(self.base);incoming.id='bad-id'
        await self.attempt(incoming, clone(self.base), 422)

    async def test_unknown_slide(self):
        incoming=clone(self.base);incoming.id=uuid.uuid4()
        await self.attempt(incoming, clone(incoming), 404)

    async def test_presentation_mismatch(self):
        incoming=clone(self.base);incoming.presentation=uuid.uuid4()
        await self.attempt(incoming, clone(incoming), 400)

    async def test_wrong_baseline_target(self):
        baseline=clone(self.base);baseline.id=uuid.uuid4()
        await self.attempt(clone(self.base), baseline, 422)

    async def test_stale_second_tab_and_repeat(self):
        a=clone(self.base);a.ui={'title':'A','body':'Original'}
        await self.attempt(a, clone(self.base), 200)
        b=clone(self.base);b.ui={'title':'Original','body':'B'}
        await self.attempt(b, clone(self.base), 409)
        await self.attempt(a, clone(self.base), 200)
        self.assertEqual((await self.read()).ui, a.ui)

    async def test_atomic_guard_with_cached_stale_row(self):
        async with self.sessions() as x, self.sessions() as y:
            retained=await y.get(SlideModel, self.base.id)
            a=clone(self.base);a.ui={'title':'A','body':'Original'}
            b=clone(self.base);b.ui={'title':'Original','body':'B'}
            await save_slide_if_unchanged(x,a,clone(self.base))
            with self.assertRaises(HTTPException) as error:
                await save_slide_if_unchanged(y,b,clone(self.base))
            self.assertEqual(error.exception.status_code,409)
            self.assertIsNotNone(retained)
        self.assertEqual((await self.read()).ui, a.ui)

    async def test_json_null_and_sql_null_are_supported(self):
        a=clone(self.base);a.speaker_note='First'
        await self.attempt(a,clone(self.base),200)
        b=clone(a);b.properties={'accent':'green'};b.ui=None
        await self.attempt(b,clone(a),200)
        c=clone(b);c.speaker_note='Next'
        await self.attempt(c,clone(b),200)
        self.assertIsNone((await self.read()).ui)

if __name__ == '__main__':
    unittest.main(verbosity=2)
