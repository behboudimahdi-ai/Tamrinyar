import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
test('local file import preserves media and IDs; retry, conflict and missing media are safe',async()=>{
  const url=new URL(process.env.WORKOUT_TEST_DATABASE_URL);
  assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname.endsWith('_qa'));
  const root=await mkdtemp(join(tmpdir(),'ty-import-')),workspace=randomUUID(),clipId=randomUUID(),bytes=Buffer.from('archived-video');
  await mkdir(join(root,'clips'));await writeFile(join(root,'clips',clipId+'.webm'),bytes);
  const data={students:[{id:'p',name:'شاگرد'}],movements:[{id:'row'}],sessions:[{id:'s',studentId:'p',entries:[{id:'e',movementId:'row',done:true}]}],reviews:[{id:'r',sessionId:'s',entryId:'e',clipId,feedback:'قبلی'}]};
  const file=join(root,'workspace.json');await writeFile(file,JSON.stringify(data));
  const run=id=>spawnSync(process.execPath,['scripts/import-workspace.mjs',root,id],{env:{...process.env,DATABASE_URL:url.href},encoding:'utf8'});
  assert.equal(run(workspace).status,0);assert.equal(run(workspace).status,0);
  const other=randomUUID();await writeFile(file,JSON.stringify({...data,reviews:[{...data.reviews[0],clipId:randomUUID()}]}));
  assert.notEqual(run(workspace).status,0);assert.notEqual(run(other).status,0);
  const client=new pg.Client({connectionString:url.href});await client.connect();
  try{assert.deepEqual((await client.query('SELECT data FROM "Workspace" WHERE id=$1',[workspace])).rows[0].data,data);
    assert.equal((await client.query('SELECT id FROM "Workspace" WHERE id=$1',[other])).rowCount,0);
    assert.deepEqual((await client.query('SELECT content FROM "Clip" WHERE id=$1',[clipId])).rows[0].content,bytes);
    assert.deepEqual(await readFile(join(root,'clips',clipId+'.webm')),bytes);
  }finally{await client.end();}
});
