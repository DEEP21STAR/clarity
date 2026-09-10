import { chromium } from 'playwright';
import fs from 'node:fs';
const URL = 'http://localhost:4173';
const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);

  const dashBtn = page.locator('nav button', { hasText: 'Dashboard' }).first();
  await dashBtn.click();
  await page.waitForTimeout(1500);

  const dataUrl = await page.evaluate(() => localStorage.getItem('clarity:thumb:dashboard'));
  if (!dataUrl) { console.log('NO THUMBNAIL CAPTURED'); await browser.close(); return; }
  const base64 = dataUrl.split(',')[1];
  fs.writeFileSync(`${OUT}/r21-thumb-dashboard-extracted.jpg`, Buffer.from(base64, 'base64'));
  console.log('Saved thumbnail, length:', dataUrl.length);

  await browser.close();
})();
