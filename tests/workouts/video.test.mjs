import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, session, call, base } from './fixture.mjs';
import { browserSession } from './browser-helper.mjs';
import { todayKey } from '../../src/features/training/model.ts';
test('a scheduled workout keeps its uploaded clip and coach feedback through archival', async () => {
  const { prefix, password, program, people } = await fixture();
  const coach = await session(prefix + 'coach', password),
    other = await session(prefix + '-othercoach', password);
  const saved = await call(coach, '/api/programs', {
    intent: 'save',
    status: 'READY',
    definition: {
      ...program,
      kind: 'custom',
      durationValue: 1,
      durationUnit: 'day',
      sessions: [program.sessions[0]],
    },
  });
  const assigned = await call(coach, '/api/programs', {
    intent: 'assign',
    ...saved.data,
    requestId: randomUUID(),
    recipients: [{ athleteId: people[0].id, start: todayKey() }],
  });
  assert.equal(assigned.status, 200);
  const student = await browserSession(prefix + 'athlete', password),
    trainer = await browserSession(prefix + 'coach', password);
  try {
    const p = student.page;
    await p.goto(base + '/', { waitUntil: 'domcontentloaded' });
    const bytes = await p.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const stream = canvas.captureStream(15);
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = [];
      const done = new Promise((resolve) => {
        rec.ondataavailable = (e) => chunks.push(e.data);
        rec.onstop = resolve;
      });
      rec.start();
      canvas.getContext('2d').fillRect(0, 0, 16, 16);
      await new Promise((resolve) => setTimeout(resolve, 180));
      rec.stop();
      await done;
      stream.getTracks().forEach((t) => t.stop());
      return Array.from(new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer()));
    });
    await p.getByRole('button', { name: 'ارسال ویدیو اسکوات هالتر' }).first().click();
    const dialog = p.getByRole('dialog');
    await dialog
      .locator('input[type=file]')
      .setInputFiles({ name: 'workout.webm', mimeType: 'video/webm', buffer: Buffer.from(bytes) });
    await dialog.getByRole('button', { name: 'ارسال ویدیو', exact: true }).click();
    await p.getByText('ویدیو برای مربی ارسال شد.').waitFor();
    const s = (await call(coach, '/api/workouts?athlete=athlete-0')).data.sessions[0];
    const rejected = await call(coach, '/api/workouts', {
      intent: 'edit',
      sessionId: s.id,
      revision: s.revision,
      scope: 'one',
      slot: s.prescription,
      reason: 'بازبینی',
    });
    assert.notEqual(rejected.status, 200);
    const t = trainer.page;
    await t.goto(base + '/?view=reviews', { waitUntil: 'domcontentloaded' });
    await t.getByRole('button', { name: /شاگرد اول.*در انتظار/ }).click();
    const clip = await t.getByRole('dialog').locator('video').getAttribute('src');
    assert.ok(clip);
    assert.equal((await t.request.get(base + clip)).status(), 200);
    assert.equal((await fetch(base + clip, { headers: { cookie: other } })).status, 404);
    assert.equal((await fetch(base + clip)).status, 401);
    await t.getByLabel('بازخورد فرم حرکت').fill('کنترل حرکت خوب بود');
    await t.getByRole('button', { name: 'ثبت بازخورد', exact: true }).click();
    await t.getByText('بازخورد برای شاگرد ثبت شد.').waitFor();
    await call(coach, '/api/programs', { intent: 'archive', ...saved.data });
    await p.goto(base + '/?view=reviews', { waitUntil: 'domcontentloaded' });
    await p
      .getByRole('button', { name: /شاگرد اول.*بررسی‌شده/ })
      .first()
      .click();
    await p.getByText('کنترل حرکت خوب بود').waitFor();
  } finally {
    await student.browser.close();
    await trainer.browser.close();
  }
});
