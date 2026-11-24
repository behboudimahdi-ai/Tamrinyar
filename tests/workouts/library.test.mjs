import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { fixture, session, base, call } from './fixture.mjs';
import { browserSession } from './browser-helper.mjs';
import { todayKey } from '../../src/features/training/model.ts';

test('program library with 70 athletes and 30 workouts today remains scoped and accessible', async () => {
  const { prefix, password, program, people } = await fixture();
  const extra = Array.from({ length: 68 }, (_, i) => ({
    ...people[0],
    id: 'more-' + i,
    name: 'نام اختصاصی شاگرد ' + i,
  }));
  const pool = new pg.Pool({ connectionString: process.env.WORKOUT_TEST_DATABASE_URL });
  try {
    await pool.query(
      'INSERT INTO "Athlete" ("coachId",id,name) SELECT $1,s->>\'id\',s->>\'name\' FROM jsonb_array_elements($2::jsonb) s',
      [prefix, JSON.stringify(extra)],
    );
    await pool.query(
      "UPDATE \"Workspace\" SET data=jsonb_set(data,'{students}',(data->'students') || $2::jsonb) WHERE id=$1",
      [prefix, JSON.stringify(extra)],
    );
  } finally {
    await pool.end();
  }
  const coach = await session(prefix + 'coach', password),
    athletes = [...people, ...extra];
  const first = await call(coach, '/api/programs', {
    intent: 'save',
    definition: {
      ...program,
      name: 'قالب توان باشگاه',
      kind: 'custom',
      durationUnit: 'day',
      durationValue: 1,
      sessions: [{ ...program.sessions[0], title: 'جلسهٔ اختصاصی روز جاری', offset: 0 }],
    },
    status: 'READY',
  });
  assert.equal(first.status, 200);
  const assigned = await call(coach, '/api/programs', {
    intent: 'assign',
    ...first.data,
    requestId: randomUUID(),
    recipients: athletes.slice(0, 30).map((p) => ({ athleteId: p.id, start: todayKey() })),
  });
  assert.equal(assigned.status, 200, JSON.stringify(assigned.data));
  const { browser, page } = await browserSession(prefix + 'coach', password);
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  try {
    const response = await page.goto(base + '/programs', { waitUntil: 'domcontentloaded' });
    const html = await response.text();
    await page.getByRole('heading', { name: 'برنامه‌های من', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: /تقویم/ }).count(), 0);
    assert.ok(!html.includes(extra[0].name) && !html.includes('جلسهٔ اختصاصی روز جاری'));
    assert.ok(!requests.some((url) => url.includes('/api/workouts') || url.includes('choices=athletes')));
    const card = page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: 'قالب توان باشگاه', exact: true }) });
    await card.getByRole('button', { name: 'تکثیر' }).click();
    await page.getByRole('heading', { name: 'رونوشت قالب توان باشگاه' }).waitFor();
    await card.getByRole('link', { name: 'ویرایش' }).click();
    await page.getByLabel('نام برنامه', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('نام برنامه', { exact: true }).inputValue(), 'قالب توان باشگاه');
    await page.goto(base + '/programs', { waitUntil: 'domcontentloaded' });
    await card.getByRole('button', { name: 'آرشیو' }).click();
    await page.getByRole('button', { name: 'تأیید آرشیو' }).click();
    await card.getByText('آرشیوشده', { exact: true }).waitFor();
    await page.goto(base + '/?view=students&athlete=athlete-0', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: people[0].name, exact: true }).waitFor();
    await page.getByRole('heading', { name: 'تقویم اختصاصی' }).waitFor();
    await page.getByRole('heading', { name: 'قالب توان باشگاه' }).waitFor();
    assert.equal(await page.getByText(people[1].name, { exact: true }).count(), 0);
    await page
      .getByRole('button', { name: /بررسی‌شده/ })
      .first()
      .click();
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.getByRole('dialog').locator('textarea').inputValue(), 'ثبت قبلی');
  } finally {
    await browser.close();
  }
});
test('athlete mobile dashboard renders personal calendar and records a movement', async () => {
  const { prefix, password, program, people } = await fixture();
  const coach = await session(prefix + 'coach', password);
  const saved = await call(coach, '/api/programs', {
    intent: 'save',
    status: 'READY',
    definition: {
      ...program,
      kind: 'custom',
      durationUnit: 'day',
      durationValue: 1,
      sessions: [program.sessions[0]],
    },
  });
  await call(coach, '/api/programs', {
    intent: 'assign',
    ...saved.data,
    requestId: randomUUID(),
    recipients: [{ athleteId: people[0].id, start: todayKey() }],
  });
  const { page, browser } = await browserSession(prefix + 'athlete', password, 375);
  try {
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'تقویم اختصاصی' }).waitFor();
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const check = page.getByRole('checkbox', { name: 'ثبت اسکوات هالتر' }).first();
    await check.click();
    await page.getByText(/۱ انجام‌شده/).waitFor();
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.ok(await check.isChecked());
    assert.equal(await page.getByText(people[1].name, { exact: true }).count(), 0);
    assert.equal(await page.getByRole('link', { name: 'ایجاد برنامه تمرینی جدید' }).count(), 0);
    await page.goto(base + '/programs', { waitUntil: 'domcontentloaded' });
    assert.equal(await page.getByRole('heading', { name: 'برنامه‌های من' }).count(), 0);
  } finally {
    await browser.close();
  }
});
