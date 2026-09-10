import { chromium } from 'playwright';
const URL = 'http://localhost:4173';
const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);

  await page.locator('nav button', { hasText: 'Debts' }).first().click();
  await page.waitForTimeout(600);
  await page.locator('button:has-text("Add debt")').click();
  await page.waitForTimeout(500);
  // Fill balance field — nth(0) is the page's "Extra Monthly Budget" input, nth(1) is the new
  // debt row's real balance field.
  const balanceInput = page.locator('input[type="number"]').nth(1);
  await balanceInput.fill('3000');
  await balanceInput.blur();
  await page.waitForTimeout(600);

  const caption = await page.locator('text=/at this pace/').count();
  console.log('CHECK debt-free date caption present after adding a real debt:', caption > 0);
  if (caption > 0) console.log('TEXT:', await page.locator('text=/at this pace/').first().textContent());
  await page.screenshot({ path: `${OUT}/r21-debts-with-date.png` });
  await browser.close();
})();
