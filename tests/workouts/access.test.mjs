import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { base, fixture } from './fixture.mjs';
test('new operational account starts empty; mobile login, draft and logout use the normal entry points', async () => {
  await fixture(); // Verifies the database and web server are local QA targets.
  const id = randomUUID(),
    login = 'coach-' + id,
    password = randomBytes(18).toString('hex');
  const provision = spawnSync(process.execPath, ['scripts/provision-account.mjs', 'COACH', id, login], {
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_URL: process.env.WORKOUT_TEST_DATABASE_URL,
      TAMRINYAR_ACCOUNT_PASSWORD: password,
    },
  });
  assert.equal(provision.status, 0, provision.stderr);
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.WORKOUT_TEST_BROWSER || undefined,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 }, locale: 'fa-IR' });
    page.setDefaultTimeout(20000);
    await page.goto(base + '/programs', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'ورود به تمرین‌یار' }).waitFor();
    await page.getByLabel('نام کاربری').fill(login);
    await page.getByLabel('گذرواژه').fill(password);
    await page.getByRole('button', { name: 'ورود', exact: true }).click();
    await page.getByRole('button', { name: 'باز کردن منو' }).click();
    await page.getByRole('button', { name: 'برنامه‌های تمرینی', exact: true }).click();
    await page.getByText('هنوز برنامه‌ای ذخیره نکرده‌اید.').waitFor();
    await page.getByRole('link', { name: 'ایجاد برنامه تمرینی جدید' }).click();
    await page.getByLabel('نام برنامه', { exact: true }).fill('پیش‌نویس اولیه');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.getByRole('button', { name: 'ذخیره پیش‌نویس' }).click();
    await page.getByText('پیش‌نویس ذخیره شد.').waitFor();
    await page.getByRole('link', { name: 'برنامه‌های من', exact: true }).click();
    await page.getByRole('heading', { name: 'پیش‌نویس اولیه' }).waitFor();
    const choices = await page.request.get(base + '/api/programs?choices=athletes');
    assert.deepEqual(await choices.json(), []);
    await page.getByRole('button', { name: 'خروج', exact: true }).click();
    await page.getByRole('heading', { name: 'ورود به تمرین‌یار' }).waitFor();
    assert.equal((await page.request.get(base + '/api/programs')).status(), 401);
  } finally {
    await browser.close();
  }
});
