import { chromium } from 'playwright';

const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';
const URL = 'http://localhost:4173';

async function goTab(page, name) {
  for (const t of await page.$$('nav button, header button, [class*="nav-tab"]')) {
    const txt = (await t.textContent())?.trim();
    if (txt && new RegExp(name, 'i').test(txt)) { await t.click(); await page.waitForTimeout(500); return; }
  }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);

  await goTab(page, 'transactions');
  const csv = 'Date,Description,Amount\n2026-08-10,New World Groceries,-80.00\n';
  await page.setInputFiles('input[type="file"]', { name: 'test.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.waitForTimeout(500);

  // Click the "uncategorised" category to edit it
  const categoryBtn = page.locator('button[title="Click to edit category"]').first();
  await categoryBtn.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/final-11-category-before-edit.png`, fullPage: false });
  await categoryBtn.click();
  await page.waitForTimeout(200);
  const input = page.locator('input.result-reveal');
  await input.fill('Groceries');
  await page.screenshot({ path: `${OUT}/final-11b-category-editing.png`, fullPage: false });
  await input.press('Enter');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/final-11c-category-after-edit.png`, fullPage: false });
  const newCategoryText = await page.evaluate(() => document.querySelector('button[title="Click to edit category"]')?.textContent);
  console.log('CATEGORY_AFTER_EDIT', newCategoryText);

  // Debts with a real nonzero balance
  await goTab(page, 'debts');
  const addDebtBtn = page.locator('button', { hasText: 'Add debt' });
  await addDebtBtn.click();
  await page.waitForTimeout(300);
  const balanceInput = page.locator('input[type="number"]').nth(1); // 0=extra budget, 1=first debt balance
  await balanceInput.fill('2000');
  await page.waitForTimeout(400);
  const timelinePresent = await page.evaluate(() => !!Array.from(document.querySelectorAll('span')).find((s) => s.textContent === 'Payoff Timeline'));
  console.log('DEBT_TIMELINE_PRESENT_WITH_REAL_BALANCE', timelinePresent);
  await page.screenshot({ path: `${OUT}/final-04c-debts-timeline-real.png`, fullPage: true });

  console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
  await browser.close();
})();
