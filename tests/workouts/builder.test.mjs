import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, base } from './fixture.mjs';
import { browserSession } from './browser-helper.mjs';
test('coach authors three sessions, previews 36, saves and assigns in the wizard', async () => {
  const { prefix, password, people } = await fixture();
  const { browser, page } = await browserSession(prefix + 'coach', password);
  const button = (name) => page.getByRole('button', { name, exact: true });
  try {
    await page.goto(base + '/programs/builder', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('نام برنامه', { exact: true }).fill('برنامهٔ آزمون');
    await page.getByLabel('هدف تمرینی', { exact: true }).fill('قدرت');
    await page.getByLabel('سطح ورزشکار').selectOption('متوسط');
    await button('بعدی').click();
    await button('بعدی').click();
    await page.getByLabel('تعداد جلسات هفتگی').fill('3');
    await page.getByLabel('روز تمرین ۲').selectOption('2');
    await page.getByLabel('روز تمرین ۳').selectOption('4');
    await button('بعدی').click();
    await page.getByLabel('نام جلسه', { exact: true }).fill('بالاتنه');
    await button('کپی حرکت').first().click();
    assert.equal(await page.getByLabel('ست', { exact: true }).count(), 2);
    await button('بعدی').click();
    await page.getByText('۳ جلسه طراحی‌شده · ۳۶ جلسه زمان‌بندی‌شده').waitFor();
    await button('بعدی').click();
    await button('ذخیره قالب').click();
    await page.getByText('قالب برنامه ذخیره شد.').waitFor();
    for (const person of people) await page.getByRole('checkbox', { name: person.name, exact: true }).check();
    await page.getByLabel('تاریخ شروع ' + people[0].name).fill('2028-01-01');
    await page.getByLabel('تاریخ شروع ' + people[1].name).fill('2028-01-10');
    await button('پیش‌نمایش تخصیص').click();
    assert.equal(await page.getByRole('region', { name: 'پیش‌نمایش همین برنامه' }).count(), 2);
    await button('تأیید تخصیص').click();
    await page.getByText('برنامه برای شاگردان انتخابی ثبت شد.').waitFor();
  } finally {
    await browser.close();
  }
});
