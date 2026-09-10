import unittest,tempfile,uuid,json
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine,async_sessionmaker
from sqlalchemy import text
from sqlmodel import SQLModel,select
from fastapi import HTTPException
from models.sql.presentation import PresentationModel,PresentationVersion
from models.sql.slide import SlideModel
from services.database import sql_engine as _registration
from services.document_compare_and_swap import save_document_if_unchanged,snapshot
from services.slide_compare_and_swap import save_slide_if_unchanged

class DocumentCASTests(unittest.IsolatedAsyncioTestCase):
 async def asyncSetUp(self):
  self.temp=tempfile.TemporaryDirectory();self.engine=create_async_engine('sqlite+aiosqlite:///'+str(Path(self.temp.name)/'t.db'));self.sessions=async_sessionmaker(self.engine,expire_on_commit=False)
  async with self.engine.begin() as c:await c.run_sync(SQLModel.metadata.create_all)
  self.doc=PresentationModel(id=uuid.uuid4(),version=PresentationVersion.V2_STANDARD,content='',n_slides=3,language='Russian',title='Original',theme={'color':'red'})
  self.slides=[SlideModel(id=uuid.uuid4(),presentation=self.doc.id,index=i,layout_group='blank',layout='blank',content={'title':str(i)},properties=None,ui={'text':str(i)}) for i in range(3)]
  async with self.sessions() as s:s.add(self.doc);s.add_all(self.slides);await s.commit()
  self.base=snapshot(self.doc,self.slides)
 async def asyncTearDown(self):await self.engine.dispose();self.temp.cleanup()
 async def attempt(self,base,changes,expected):
  async with self.sessions() as s:
   if expected==200:return await save_document_if_unchanged(s,self.doc.id,base,changes)
   with self.assertRaises(HTTPException) as error:await save_document_if_unchanged(s,self.doc.id,base,changes)
   self.assertEqual(error.exception.status_code,expected)
 async def saved(self):
  async with self.sessions() as s:
   p=await s.get(PresentationModel,self.doc.id);slides=list((await s.scalars(select(SlideModel).where(SlideModel.presentation==self.doc.id).order_by(SlideModel.index))).all());return snapshot(p,slides)
 async def test_missing_baseline(self):await self.attempt(None,{'title':'bad'},428);self.assertEqual(await self.saved(),self.base)
 async def test_metadata_does_not_clear_theme(self):
  await self.attempt(self.base,{'title':'Renamed'},200);new=await self.saved();self.assertEqual(new['theme'],{'color':'red'});self.assertEqual(new['slides'],self.base['slides'])
 async def test_stale_full_deck_cannot_bypass_slide_guard(self):
  incoming=SlideModel.model_validate_json(self.slides[0].model_dump_json());incoming.ui={'text':'A'}
  async with self.sessions() as s:await save_slide_if_unchanged(s,incoming,self.slides[0])
  stale=json.loads(json.dumps(self.base['slides']));stale[1]['ui']={'text':'B'}
  await self.attempt(self.base,{'slides':stale,'n_slides':3},409);new=await self.saved();self.assertEqual(new['slides'][0]['ui'],{'text':'A'});self.assertEqual(new['slides'][1]['ui'],{'text':'1'})
 async def test_reorder_and_identical_retry(self):
  desired=list(reversed(json.loads(json.dumps(self.base['slides']))))
  for i,s in enumerate(desired):s['index']=i
  await self.attempt(self.base,{'slides':desired},200);await self.attempt(self.base,{'slides':desired},200);self.assertEqual((await self.saved())['slides'],desired)
 async def test_structural_change_rejects_old_slide_write(self):
  desired=self.base['slides'][1:]
  desired=json.loads(json.dumps(desired))
  for i,s in enumerate(desired):s['index']=i
  await self.attempt(self.base,{'slides':desired},200)
  incoming=SlideModel.model_validate_json(self.slides[0].model_dump_json());incoming.ui={'text':'late'}
  async with self.sessions() as s:
   with self.assertRaises(HTTPException) as e:await save_slide_if_unchanged(s,incoming,self.slides[0])
   self.assertEqual(e.exception.status_code,404)
 async def test_invalid_count_and_duplicate_rejected_atomically(self):
  await self.attempt(self.base,{'title':'bad','slides':[]},422)
  bad=json.loads(json.dumps(self.base['slides']));bad[1]['id']=bad[0]['id'];await self.attempt(self.base,{'title':'bad','slides':bad},422)
  await self.attempt(self.base,{'n_slides':9},422);self.assertEqual(await self.saved(),self.base)
 async def test_foreign_slide_id_rejected(self):
  other=SlideModel(id=uuid.uuid4(),presentation=uuid.uuid4(),index=0,layout_group='blank',layout='blank',content={},properties=None)
  async with self.sessions() as s:s.add(other);await s.commit()
  bad=json.loads(json.dumps(self.base['slides']));bad[0]['id']=str(other.id)
  await self.attempt(self.base,{'slides':bad},409);self.assertEqual(await self.saved(),self.base)
 async def test_database_failure_rolls_back_deletion(self):
  async with self.engine.begin() as c:await c.execute(text("CREATE TRIGGER audit_fail BEFORE INSERT ON slides BEGIN SELECT RAISE(ABORT, 'audit injected failure'); END"))
  desired=json.loads(json.dumps(self.base['slides']));desired[0]['content']={'title':'new'}
  async with self.sessions() as s:
   with self.assertRaises(Exception):await save_document_if_unchanged(s,self.doc.id,self.base,{'slides':desired,'title':'bad'})
  self.assertEqual(await self.saved(),self.base)

 async def test_two_simultaneous_structural_writers_only_one_wins(self):
  import asyncio
  async def writer(title):
   async with self.sessions() as session:
    try:await save_document_if_unchanged(session,self.doc.id,self.base,{'title':title});return 200
    except HTTPException as e:return e.status_code
  results=await asyncio.gather(writer('A'),writer('B'))
  self.assertEqual(sorted(results),[200,409])
 async def test_foreign_owner_cannot_mutate_document(self):
  from api.v1.auth.context import set_current_owner_id,reset_current_owner_id
  token=set_current_owner_id(uuid.uuid4())
  try:await self.attempt(self.base,{'title':'foreign'},404)
  finally:reset_current_owner_id(token)
  self.assertEqual(await self.saved(),self.base)

if __name__=='__main__':unittest.main(verbosity=2)
