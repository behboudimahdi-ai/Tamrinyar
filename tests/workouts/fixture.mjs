import assert from 'node:assert/strict';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import pg from 'pg';
import { defaultMovements } from '../../src/features/training/catalog.ts';
import { freshProgram, newSession } from '../../src/features/programs/definition.ts';
export const base = process.env.WORKOUT_TEST_URL || 'http://127.0.0.1:3185';
export async function fixture() {
  const url = new URL(process.env.WORKOUT_TEST_DATABASE_URL);
  assert.ok(
    ['localhost', '127.0.0.1'].includes(url.hostname) &&
      url.pathname.endsWith('_qa') &&
      ['localhost', '127.0.0.1'].includes(new URL(base).hostname),
    'Requires a local disposable _qa database',
  );
  const pool = new pg.Pool({ connectionString: url.href });
  const prefix = randomUUID();
  const password = randomBytes(20).toString('hex');
  const salt = randomBytes(12).toString('hex'),
    hash = salt + ':' + scryptSync(password, salt, 64).toString('hex');
  const people = ['اول', 'دوم'].map((name, i) => ({
    id: 'athlete-' + i,
    name: 'شاگرد ' + name,
    age: 27,
    level: 'متوسط',
    goal: 'قدرت',
    weight: 75,
    color: 'mint',
    injury: '',
  }));
  const old = {
    id: 'legacy',
    studentId: people[0].id,
    title: 'جلسهٔ قبلی',
    date: '2025-01-01',
    entries: [{ id: 'old-entry', movementId: 'squat', sets: 3, reps: 8, done: true }],
  };
  const legacy = {
    students: people,
    movements: defaultMovements,
    sessions: [old],
    reviews: [
      { id: 'review', sessionId: 'legacy', entryId: 'old-entry', date: '2025-01-01', feedback: 'ثبت قبلی' },
    ],
  };
  for (const coachId of [prefix, prefix + '-other']) {
    await pool.query('INSERT INTO "Workspace" (id,data,"updatedAt") VALUES ($1,$2,now())', [coachId, legacy]);
    for (const p of people)
      await pool.query('INSERT INTO "Athlete" ("coachId",id,name) VALUES ($1,$2,$3)', [
        coachId,
        p.id,
        p.name,
      ]);
    for (const [role, athleteId] of [
      ['COACH', null],
      ['ATHLETE', people[0].id],
    ])
      await pool.query(
        'INSERT INTO "Account" (id,login,"passwordHash",role,"coachId","athleteId") VALUES ($1,$2,$3,$4,$5,$6)',
        [randomUUID(), coachId + role.toLowerCase(), hash, role, coachId, athleteId],
      );
  }
  await pool.end();
  const program = {
    ...freshProgram(),
    name: 'توان هفتگی',
    goal: 'قدرت',
    level: 'متوسط',
    sessions: [0, 2, 4].map((weekday, i) => ({ ...newSession(i, 'squat'), weekday })),
  };
  return { prefix, password, people, legacy, program };
}
export async function session(username, password) {
  const res = await fetch(base + '/api/session', {
    method: 'POST',
    body: new URLSearchParams({ login: username, password }),
  });
  assert.equal(res.status, 200, await res.text());
  return res.headers.get('set-cookie').split(';')[0];
}
export async function call(cookie, path, body) {
  const res = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { cookie, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text.slice(0, 350) };
  }
  return { status: res.status, data };
}
