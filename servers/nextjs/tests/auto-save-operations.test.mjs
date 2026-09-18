import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
let dir, ops, diff;
test.before(async()=>{
  dir=await mkdtemp(path.join(tmpdir(),'presenton-ops-'));
  const file=path.join(dir,'entry.ts');
  await writeFile(file, `
    export { createAutoSaveSnapshot } from ${JSON.stringify(path.resolve('app/(presentation-generator)/presentation/utils/autoSaveDiff.ts'))};
    export { buildAutoSaveOperations } from ${JSON.stringify(path.resolve('app/(presentation-generator)/presentation/utils/autoSaveOperations.ts'))};
  `);
  await build({entryPoints:[file],outfile:path.join(dir,'out.mjs'),bundle:true,platform:'node',format:'esm',tsconfig:path.resolve('tsconfig.json'),logLevel:'silent'});
  ops=await import(pathToFileURL(path.join(dir,'out.mjs')).href);
});
test.after(async()=>{await rm(dir,{recursive:true,force:true})});

const slide=(id,index,note='n')=>({id,index,layout_group:'g',layout:'l',content:{id},speaker_note:note,ui:{}});

test('content-only change is UpdateSlide', () => {
  const data={id:'doc',title:'T',theme:{c:1},slides:[slide('a',0,'old'),slide('b',1)]};
  const acknowledged=ops.createAutoSaveSnapshot(data);
  const next={...data,slides:[slide('a',0,'new'),slide('b',1)]};
  const operations=ops.buildAutoSaveOperations(acknowledged,next);
  assert.deepEqual(operations.map(o=>o.operationType),['UpdateSlide']);
  assert.deepEqual(operations[0].targetIds,['a']);
  assert.equal(operations[0].payload.speaker_note,'new');
});

test('metadata-only is UpdateMetadata', () => {
  const data={id:'doc',title:'T',theme:{c:1},slides:[slide('a',0)]};
  const acknowledged=ops.createAutoSaveSnapshot(data);
  const operations=ops.buildAutoSaveOperations(acknowledged,{...data,title:'N'});
  assert.deepEqual(operations,[{
    scope:'document',targetIds:[],operationType:'UpdateMetadata',payload:{title:'N',theme:{c:1}}
  }]);
});

test('insert at front, delete, and reorder become a batch', () => {
  const data={id:'doc',title:'T',theme:null,slides:[slide('a',0),slide('b',1),slide('c',2)]};
  const acknowledged=ops.createAutoSaveSnapshot(data);
  const next={id:'doc',title:'T',theme:null,slides:[slide('d',0,'front'),slide('b',1),slide('a',2)]};
  const types=ops.buildAutoSaveOperations(acknowledged,next).map(o=>`${o.operationType}:${(o.targetIds[0]||o.payload.id||'')}`);
  assert.ok(types.includes('DeleteSlide:c'));
  assert.ok(types.some(t=>t.startsWith('InsertSlide')));
  assert.ok(types.includes('MoveSlide:a') || types.includes('MoveSlide:b'));
});
