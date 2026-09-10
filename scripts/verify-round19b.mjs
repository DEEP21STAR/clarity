import { chromium } from 'playwright';

const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';
const URL = 'http://localhost:4173';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);

  // Calendar re-check — past-dated entries should now be neutral, not red.
  for (const t of await page.$$('nav button, header button, [class*="nav-tab"]')) {
    const txt = (await t.textContent())?.trim();
    if (txt && /calendar/i.test(txt)) { await t.click(); break; }
  }
  await page.waitForTimeout(600);
  const calendarColors = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('[title*=":"]'));
    return cells.map((c) => ({ title: c.getAttribute('title'), className: c.className }));
  });
  console.log('CALENDAR_ENTRY_COLORS_AFTER_FIX', JSON.stringify(calendarColors, null, 2));
  await page.screenshot({ path: `${OUT}/r19-01c-calendar-traffic-light-FIXED.png`, fullPage: true });

  // Periodic Bill gauge banner — scroll to it directly.
  for (const t of await page.$$('nav button, header button, [class*="nav-tab"]')) {
    const txt = (await t.textContent())?.trim();
    if (txt && /upcoming/i.test(txt)) { await t.click(); break; }
  }
  await page.waitForTimeout(700);
  const gasHeading = page.locator('span', { hasText: 'Gas' }).first();
  if (await gasHeading.count() > 0) {
    await gasHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  }
  const periodicBanner = await page.evaluate(() => {
    const banner = Array.from(document.querySelectorAll('div')).find((d) => d.textContent?.trim().startsWith('Bill due') && d.className.includes('rounded-lg'));
    if (!banner) return null;
    return { className: banner.className, text: banner.textContent };
  });
  console.log('PERIODIC_BILL_BANNER_AFTER_FIX', JSON.stringify(periodicBanner));
  await page.screenshot({ path: `${OUT}/r19-01b-periodic-gauge-FIXED.png`, fullPage: false });

  await browser.close();
})();
