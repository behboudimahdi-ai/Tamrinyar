import {schedule} from '../../src/features/programs/recurrence.ts';
import {newSession} from '../../src/features/programs/definition.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { fixture, session, call } from './fixture.mjs';
import { offsetDate, todayKey } from '../../src/features/training/model.ts';
test('single and future edits isolate an athlete, a slot, completed work and template versions', async () => {
  const { prefix, password, program, people } = await fixture();
  const coach = await session(prefix + 'coach', password),
    athlete = await session(prefix + 'athlete', password),
    other = await session(prefix + '-othercoach', password);
  const saved = await call(coach, '/api/programs', { intent: 'save', status: 'READY', definition: program });
  const start = offsetDate(todayKey(), 2),
    recipients = people.map((p) => ({ athleteId: p.id, start }));
  const assign = await call(coach, '/api/programs', {
    intent: 'assign',
    ...saved.data,
    requestId: randomUUID(),
    recipients,
  });
  assert.equal(assign.status, 200);
  const read = async (name) => (await call(coach, '/api/workouts?athlete=' + name)).data.sessions;
  const all = await read(people[0].id),
    first = all[0];
  const same = all.filter((s) => s.prescription.id === first.prescription.id);
  const change = {
    intent: 'edit',
    sessionId: first.id,
    scope: 'one',
    revision: first.revision,
    reason: 'تنظیم مربی',
    slot: { ...first.prescription, title: 'جلسهٔ ویرایش‌شده' },
  };
  assert.notEqual((await call(other, '/api/workouts', change)).status, 200);
  assert.notEqual((await call(athlete, '/api/workouts', change)).status, 200);
  assert.equal((await call(coach, '/api/workouts', change)).data.count, 1);
  assert.notEqual((await call(coach, '/api/workouts', change)).status, 200);
  const completed = same[2];
  for (const entry of completed.entries)
    assert.equal(
      (
        await call(athlete, '/api/workouts', {
          intent: 'complete',
          sessionId: completed.id,
          entryId: entry.id,
          done: true,
        })
      ).status,
      200,
    );
  const future = {
    ...change,
    scope: 'future',
    sessionId: same[1].id,
    revision: same[1].revision,
    slot: { ...first.prescription, title: 'جلسات آینده' },
  };
  const affected = await call(coach, '/api/workouts', future);
  assert.equal(affected.status, 200, JSON.stringify(affected.data));
  assert.equal(affected.data.count, same.length - 2);
  const result = await read(people[0].id);
  assert.equal(result.find((s) => s.id === first.id).title, 'جلسهٔ ویرایش‌شده');
  assert.equal(result.find((s) => s.id === completed.id).title, completed.title);
  assert.ok(
    result.filter((s) => s.prescription.id !== first.prescription.id).every((s) => s.title !== 'جلسات آینده'),
  );
  assert.ok((await read(people[1].id)).every((s) => s.title !== 'جلسات آینده'));
  assert.deepEqual((await call(coach, '/api/programs?id=' + saved.data.id)).data.definition, program);
});
test('late invalid recipient rolls back the entire batch and search/pagination return summaries', async () => {
  const { prefix, password, program, people } = await fixture(),
    coach = await session(prefix + 'coach', password);
  const draft = {
    ...program,
    kind: 'custom',
    durationUnit: 'month',
    durationValue: 1,
    sessions: [{ ...program.sessions[0], offset: 30 }],
  };
  const { data: saved } = await call(coach, '/api/programs', {
    intent: 'save',
    status: 'READY',
    definition: draft,
  });
  const requestId = randomUUID();
  const result = await call(coach, '/api/programs', {
    intent: 'assign',
    ...saved,
    requestId,
    recipients: [
      { athleteId: people[0].id, start: '2024-04-20' },
      { athleteId: people[1].id, start: '2024-10-22' },
    ],
  });
  assert.notEqual(result.status, 200);
  const pool = new pg.Pool({ connectionString: process.env.WORKOUT_TEST_DATABASE_URL });
  try {
    assert.equal(
      (
        await pool.query('SELECT count(*)::int AS n FROM "ProgramAssignment" WHERE "requestId"=$1', [
          requestId,
        ])
      ).rows[0].n,
      0,
    );
  } finally {
    await pool.end();
  }
  for (let i = 0; i < 13; i++) {
    const r = await call(coach, '/api/programs', {
      intent: 'save',
      status: 'DRAFT',
      definition: { ...program, name: 'پیش‌نویس گروه ' + i, goal: '', level: '', sessions: [] },
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  }
  const query = '/api/programs?status=DRAFT&q=' + encodeURIComponent('گروه');
  const p1 = await call(coach, query),
    p2 = await call(coach, query + '&page=2');
  assert.equal(p1.data.total, 13);
  assert.equal(p1.data.items.length, 12);
  assert.equal(p2.data.items.length, 1);
  assert.ok(p1.data.items.every((s) => !('definition' in s) && !('sessions' in s)));
  assert.ok(!p1.data.items.some((s) => s.id === p2.data.items[0].id));
});

test('saved weekly, four-week and custom assignments match every date in their previews',async()=>{
  const {prefix,password,program,people}=await fixture(),coach=await session(prefix+'coach',password);
  const slots=(count,spacing)=>Array.from({length:count},(_,i)=>({...newSession(i,'row'),offset:i*spacing}));
  const cases=[
    [{...program,kind:'weekly',durationValue:8,sessions:slots(4,1)},32],
    [{...program,kind:'weeks',durationValue:12,cycleLength:4,sessions:slots(12,2)},36],
    [{...program,kind:'custom',durationValue:30,durationUnit:'day',sessions:slots(15,2)},15],
    [{...program,kind:'months',durationValue:3,durationUnit:'month',cycleLength:1,sessions:[{...newSession(0,'row'),offset:0}]},3],
  ];
  for(const [definition,count] of cases){
    const saved=await call(coach,'/api/programs',{intent:'save',status:'READY',definition});
    assert.equal(saved.status,200,JSON.stringify(saved.data));
    const start='2024-09-21';const assigned=await call(coach,'/api/programs',{intent:'assign',...saved.data,requestId:randomUUID(),recipients:[{athleteId:people[0].id,start}]});
    assert.equal(assigned.status,200,JSON.stringify(assigned.data));
    const read=await call(coach,'/api/workouts?athlete=athlete-0');
    const dates=read.data.sessions.filter(s=>s.assignmentId===assigned.data.ids[0]).map(s=>s.date).sort();
    assert.equal(dates.length,count);assert.deepEqual(dates,schedule(definition,start).occurrences.map(s=>s.date));
  }
});
