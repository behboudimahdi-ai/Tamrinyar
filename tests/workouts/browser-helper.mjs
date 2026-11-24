import { chromium } from 'playwright';
import { base } from './fixture.mjs';
export async function browserSession(login, password, width = 1280) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.WORKOUT_TEST_BROWSER || undefined,
  });
  try {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'fa-IR' });
    const res = await context.request.post(base + '/api/session', { form: { login, password } });
    if (!res.ok()) throw Error('Test login failed: ' + (await res.text()));
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(60000);
    return { browser, context, page };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
