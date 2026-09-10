import { chromium } from 'playwright';
const URL = 'http://localhost:4173';
const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);

  // Partial payment case ($150 against the $305.33 minimum, under it): click the card-level
  // "Record a payment" specifically (the FIRST one on the page, directly under the card header
  // — plan-level ones live further down and were what the ambiguous locator grabbed before).
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('span')).find((s) => s.textContent === 'GEM VISA Deep');
    el?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Record a payment")').first().click({ force: true });
  await page.waitForTimeout(300);
  await page.locator('input[type="number"]').first().fill('150');
  await page.locator('button:has-text("Record")').first().click({ force: true });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/rings-partial-payment.png`, timeout: 60000 });

  // Debts tab aggregate ring
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Debts');
    el?.click();
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/rings-debts-aggregate.png`, timeout: 60000 });

  await browser.close();
})();
