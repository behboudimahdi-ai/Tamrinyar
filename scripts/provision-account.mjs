import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import pg from 'pg';
import { defaultMovements } from '../src/features/training/catalog.ts';
const [role, coachId, username, athleteId] = process.argv.slice(2);
const password = process.env.TAMRINYAR_ACCOUNT_PASSWORD;
if (
  !['COACH', 'ATHLETE'].includes(role) ||
  !coachId ||
  !username ||
  !password ||
  password.length < 12 ||
  (role === 'ATHLETE') !== Boolean(athleteId) ||
  !process.env.DATABASE_URL
) {
  throw Error(
    'Use COACH workspace login or ATHLETE workspace login athleteId, with DATABASE_URL and TAMRINYAR_ACCOUNT_PASSWORD (12+ characters).',
  );
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  if (role === 'COACH') {
    const data = { students: [], sessions: [], reviews: [], movements: defaultMovements };
    await client.query(
      'INSERT INTO "Workspace" ("id","data","updatedAt") VALUES ($1,$2,now()) ON CONFLICT DO NOTHING',
      [coachId, data],
    );
  }
  const salt = randomBytes(24).toString('hex');
  const hash = salt + ':' + scryptSync(password, salt, 64).toString('hex');
  await client.query(
    'INSERT INTO "Account" ("id","login","passwordHash","role","coachId","athleteId") VALUES ($1,$2,$3,$4,$5,$6)',
    [randomUUID(), username.trim().toLowerCase(), hash, role, coachId, athleteId ?? null],
  );
  await client.query('COMMIT');
  console.log('Account provisioned.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
