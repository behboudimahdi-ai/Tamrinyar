// Import an explicitly selected server-file workspace. Only the destination PostgreSQL database is written.
import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import pg from 'pg';
const [source,workspaceId]=process.argv.slice(2);
if(!source||!workspaceId||!process.env.DATABASE_URL)throw Error('Usage: npm run workspace:import -- <.data directory> <workspace ID>');
const root=resolve(source),data=JSON.parse(await readFile(join(root,'workspace.json'),'utf8'));
for(const key of ['students','sessions','movements','reviews'])if(!Array.isArray(data[key]))throw Error('Missing collection: '+key);
const students=new Set(data.students.map(s=>s.id)), moves=new Set(data.movements.map(m=>m.id));
const sessions=new Map(data.sessions.map(s=>[s.id,s]));
if(students.size!==data.students.length||moves.size!==data.movements.length||sessions.size!==data.sessions.length||
    data.students.some(s=>typeof s.id!=='string'||!s.id||typeof s.name!=='string')||
    data.sessions.some(s=>!students.has(s.studentId)||!Array.isArray(s.entries)||s.entries.some(e=>!moves.has(e.movementId)))||
    data.reviews.some(r=>!sessions.get(r.sessionId)?.entries.some(e=>e.id===r.entryId)))throw Error('Legacy references need review before import.');
const clips=new Set([...data.reviews.map(r=>r.clipId),...data.movements.map(m=>m.video)].filter(Boolean));
const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO "Workspace" (id,data,"updatedAt") VALUES ($1,$2,now()) ON CONFLICT DO NOTHING',[workspaceId,data]);
  const same=await client.query('SELECT id FROM "Workspace" WHERE id=$1 AND data=$2::jsonb FOR UPDATE',[workspaceId,data]);
  if(!same.rowCount)throw Error('Destination already contains different data; choose the correct unused workspace ID.');
  for(const p of data.students)await client.query('INSERT INTO "Athlete" ("coachId",id,name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',[workspaceId,p.id,p.name]);
  for(const id of clips){
    if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))throw Error('Invalid clip identifier.');
    let bytes,mime;
    for(const extension of ['mp4','webm']){
      try{bytes=await readFile(join(root,'clips',id+'.'+extension));mime='video/'+extension;break;}
      catch(error){if(error.code!=='ENOENT')throw error;}
    }
    if(!bytes)throw Error('A referenced clip is missing: '+id);
    await client.query('INSERT INTO "Clip" (id,content,mime) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',[id,bytes,mime]);
    if(!(await client.query('SELECT id FROM "Clip" WHERE id=$1 AND content=$2 AND mime=$3',[id,bytes,mime])).rowCount)throw Error('Conflicting clip identifier: '+id);
  }
  await client.query('COMMIT');console.log('Workspace, roster and referenced clips imported.');
}catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}
