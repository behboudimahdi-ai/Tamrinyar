import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
test('additive migration preserves pre-existing JSON, IDs, clips, and revision while indexing the roster', async () => {
  const url = new URL(process.env.WORKOUT_TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.endsWith('_qa'));
  const db = new pg.Client({ connectionString: url.href });
  await db.connect();
  const schema = 'qa_' + randomUUID().replaceAll('-', '');
  const read = (name) =>
    readFile(new URL('../../prisma/migrations/' + name + '/migration.sql', import.meta.url), 'utf8');
  try {
    await db.query('BEGIN');
    await db.query('CREATE SCHEMA ' + schema);
    await db.query('SET LOCAL search_path TO ' + schema);
    await db.query(await read('20261112000000_init'));
    const data = {
      students: [{ id: 'old', name: 'شاگرد قبلی' }],
      movements: [{ id: 'row' }],
      sessions: [
        {
          id: 's',
          studentId: 'old',
          date: '2024-01-18',
          entries: [{ id: 'e', movementId: 'row', done: true }],
        },
      ],
      reviews: [{ id: 'r', sessionId: 's', entryId: 'e', clipId: 'c', feedback: 'بازخورد' }],
    };
    await db.query('INSERT INTO "Workspace" (id,data,revision,"updatedAt") VALUES ($1,$2,9,now())', [
      'existing',
      data,
    ]);
    await db.query('INSERT INTO "Clip" (id,content,mime) VALUES ($1,$2,$3)', [
      'c',
      Buffer.from('clip'),
      'video/webm',
    ]);
    await db.query(await read('20261124000000_workout_programs'));
    assert.deepEqual((await db.query('SELECT data,revision FROM "Workspace"')).rows, [{ data, revision: 9 }]);
    assert.deepEqual((await db.query('SELECT * FROM "Athlete"')).rows, [
      { coachId: 'existing', id: 'old', name: 'شاگرد قبلی' },
    ]);
    assert.equal((await db.query('SELECT content FROM "Clip"')).rows[0].content.toString(), 'clip');
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
});
