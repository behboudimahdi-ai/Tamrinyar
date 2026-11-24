import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProgram, newSession, parseDefinition } from '../../src/features/programs/definition.ts';
import { schedule } from '../../src/features/programs/recurrence.ts';
const make = (days = [0, 2, 4]) => ({
  ...freshProgram(),
  name: 'قدرت',
  goal: 'آمادگی',
  level: 'متوسط',
  sessions: days.map((weekday, i) => ({ ...newSession(i, 'squat'), weekday })),
});
test('weekly schedules match real weekdays even with a Tuesday start', () => {
  const a = schedule(make(), '2026-11-24');
  assert.equal(a.occurrences.length, 36);
  assert.equal(a.occurrences[0].date, '2026-11-25');
  assert.equal(a.completeCycles, 12);
  assert.equal(a.end, '2027-02-15');
  const b = schedule({ ...make([0, 1, 3, 5]), durationValue: 8 }, '2026-11-28');
  assert.equal(b.occurrences.length, 32);
});
test('multiweek, partial cycles and nonrepeating programs', () => {
  const slots = Array.from({ length: 12 }, (_, i) => ({ ...newSession(i, 'squat'), offset: i * 2 }));
  const cycle = { ...make(), kind: 'weeks', cycleLength: 4, sessions: slots };
  assert.equal(schedule(cycle, '2026-11-24').occurrences.length, 36);
  const p = schedule({ ...cycle, durationValue: 5 }, '2026-11-24');
  assert.equal(p.occurrences.length, 16);
  assert.equal(p.completeCycles, 1);
  const custom = {
    ...make(),
    kind: 'custom',
    durationUnit: 'day',
    durationValue: 30,
    sessions: Array.from({ length: 15 }, (_, i) => ({ ...newSession(i, 'row'), offset: i * 2 })),
  };
  assert.equal(schedule(custom, '2026-11-24').occurrences.length, 15);
  assert.throws(() => schedule({ ...custom, durationValue: 28 }, '2026-11-24'));
});
test('Persian month boundaries clamp from original anchor, omit out-of-cycle days', () => {
  const p = {
    ...make(),
    durationUnit: 'month',
    durationValue: 3,
    kind: 'months',
    cycleLength: 1,
    sessions: [
      { ...newSession(0, 'row'), offset: 0 },
      { ...newSession(1, 'row'), offset: 30 },
    ],
  };
  const a = schedule(p, '2024-09-21'); // Shahrivar 31, 1403
  assert.deepEqual(
    a.occurrences.filter((o) => o.slotId === p.sessions[0].id).map((o) => o.date),
    ['2024-09-21', '2024-10-21', '2024-11-20'],
  );
  assert.equal(a.occurrences.length, 3);
  assert.equal(a.end, '2024-12-19');
  assert.ok(a.occurrences.every((o) => o.date <= a.end));
  assert.throws(() => schedule(p, '2024-02-30'));
});
test('validation rejects duplicate weekdays and invalid advanced prescriptions', () => {
  assert.throws(() => parseDefinition(make([1, 1])));
  const p = make();
  p.sessions[0].entries[0].rpe = 11;
  assert.throws(() => parseDefinition(p));
  assert.doesNotThrow(() => parseDefinition({ ...freshProgram(), name: 'پیش‌نویس' }, false));
});
