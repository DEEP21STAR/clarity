import { chromium } from 'playwright';
const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';
const URL = 'http://localhost:4173';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);

  // Go to Net Worth tab and bump the savings account balance via its real input, so the health
  // card's emergency-fund runway line has a genuine non-zero balance to project from.
  const netWorthBtn = page.locator('nav button', { hasText: 'Net Worth' }).first();
  await netWorthBtn.click();
  await page.waitForTimeout(600);
  const savingsInput = page.locator('text=Savings').locator('xpath=following::input[1]').first();
  await savingsInput.fill('5000');
  await savingsInput.blur();
  await page.waitForTimeout(400);

  const dashBtn = page.locator('nav button', { hasText: 'Dashboard' }).first();
  await dashBtn.click();
  await page.waitForTimeout(1000);
  const line = await page.locator('text=/Savings alone cover fixed bills until/').count();
  console.log('CHECK emergency fund runway line present after real savings balance set:', line > 0);
  if (line > 0) {
    const text = await page.locator('text=/Savings alone cover fixed bills until/').first().textContent();
    console.log('LINE TEXT:', text);
  }
  await page.screenshot({ path: `${OUT}/r21-ef-runway.png`, fullPage: true });
  await browser.close();
})();
