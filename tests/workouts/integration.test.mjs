import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { fixture, session, call } from './fixture.mjs';
test('PostgreSQL assignment, immutable versions, retries, logs and tenant isolation', async () => {
  const { prefix, password, program, people, legacy } = await fixture();
  const coach = await session(prefix + 'coach', password),
    other = await session(prefix + '-othercoach', password),
    athlete = await session(prefix + 'athlete', password);
  const path = '/api/programs',
    save = { intent: 'save', status: 'READY', definition: program };
  assert.equal((await call('', path)).status, 401);
  assert.equal((await call(athlete, path, save)).status, 403);
  const saved = await call(coach, path, save);
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  const { id, revision } = saved.data;
  assert.notEqual((await call(other, path + '?id=' + id)).status, 200);
  const assign = {
    intent: 'assign',
    id,
    revision,
    requestId: randomUUID(),
    recipients: people.map((p, i) => ({ athleteId: p.id, start: i ? '2028-01-10' : '2028-01-01' })),
  };
  const failed = await call(coach, path, {
    ...assign,
    requestId: randomUUID(),
    recipients: [assign.recipients[0], { athleteId: 'absent', start: '2028-01-02' }],
  });
  assert.notEqual(failed.status, 200);
  const result = await Promise.all([call(coach, path, assign), call(coach, path, assign)]);
  assert.ok(
    result.every((r) => r.status === 200),
    JSON.stringify(result),
  );
  assert.deepEqual(result[0].data.ids.sort(), result[1].data.ids.sort());
  const mine = await call(athlete, '/api/workouts?athlete=athlete-0');
  assert.equal(mine.data.sessions.length, 36);
  const second = await call(coach, '/api/workouts?athlete=athlete-1');
  assert.equal(second.data.sessions.length, 36);
  assert.notEqual(mine.data.sessions[0].date, second.data.sessions[0].date);
  assert.equal((await call(athlete, '/api/workouts?athlete=athlete-1')).status, 403);
  const row = mine.data.sessions[0];
  const log = { intent: 'complete', sessionId: row.id, entryId: row.entries[0].id, done: true };
  assert.notEqual((await call(other, '/api/workouts', log)).status, 200);
  assert.equal((await call(athlete, '/api/workouts', log)).status, 200);
  const after = await call(coach, path, {
    ...save,
    id,
    revision,
    definition: { ...program, name: 'ویرایش دوم' },
  });
  assert.equal(after.status, 200);
  assert.equal((await call(coach, path, { intent: 'duplicate', id })).status, 200);
  assert.equal(
    (await call(coach, path, { intent: 'archive', id, revision: after.data.revision })).status,
    200,
  );
  assert.equal((await call(coach, path, assign)).status, 200);
  assert.notEqual(
    (await call(coach, path, { ...assign, requestId: randomUUID(), revision: after.data.revision })).status,
    200,
  );
  const preserved = await call(athlete, '/api/workouts?athlete=athlete-0');
  assert.equal(preserved.data.sessions[0].programName, program.name);
  assert.equal(preserved.data.sessions[0].entries[0].done, true);
  const pool = new pg.Pool({ connectionString: process.env.WORKOUT_TEST_DATABASE_URL });
  try {
    const old = await pool.query('SELECT data FROM "Workspace" WHERE id=$1', [prefix]);
    assert.deepEqual(old.rows[0].data, legacy);
  } finally {
    await pool.end();
  }
});
