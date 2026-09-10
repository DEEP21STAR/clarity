import { chromium } from 'playwright';
const URL = 'http://localhost:4173';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  page.on('console', (msg) => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('PAGEERROR:', String(err)));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);

  const dashBtn = page.locator('nav button', { hasText: 'Dashboard' }).first();
  await dashBtn.click();
  console.log('Waiting for the 900ms capture timer + settle...');
  await page.waitForTimeout(2000);

  const storageCheck = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('clarity:thumb:'));
    return { keys, dashboardThumbLen: localStorage.getItem('clarity:thumb:dashboard')?.length ?? null };
  });
  console.log('STORAGE CHECK:', JSON.stringify(storageCheck));

  await browser.close();
})();
