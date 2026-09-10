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

  // ---- Import a real synthetic CSV so Transactions/Budgets category-trend has real data ----
  await goTab(page, 'transactions');
  const csv = 'Date,Description,Amount,Category\n2026-07-15,New World Groceries,-120.00,Groceries\n2026-08-10,New World Groceries,-80.00,Groceries\n2026-08-20,Z Energy Gas,-60.00,Fuel\n2026-09-05,Salary,3000.00,Income\n';
  const buffer = Buffer.from(csv);
  await page.setInputFiles('input[type="file"]', { name: 'test.csv', mimeType: 'text/csv', buffer });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/final-02b-transactions-after-import.png`, fullPage: false });

  const searchBox = page.locator('input[placeholder*="Search description"]');
  await searchBox.fill('groceries');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/final-02c-transactions-search-highlighted.png`, fullPage: false });
  const highlightCount = await page.evaluate(() => document.querySelectorAll('mark.search-hit').length);
  console.log('SEARCH_HIGHLIGHT_MARKS_AFTER_IMPORT', highlightCount);
  const categoryColorInfo = await page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll('td span[style*="background"]'));
    return dots.slice(0, 3).map((d) => d.getAttribute('style'));
  });
  console.log('CATEGORY_DOT_COLORS', JSON.stringify(categoryColorInfo));

  // ---- Budgets category trend now has real data ----
  await goTab(page, 'budgets');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/final-03b-budgets-category-trend.png`, fullPage: true });
  const trendInsightText = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).find((d) => /spend (up|down) \d+%/.test(d.textContent || ''));
    return el?.textContent;
  });
  console.log('TREND_INSIGHT_TEXT', trendInsightText);

  // ---- Add a real debt to exercise the payoff timeline chart ----
  await goTab(page, 'debts');
  await page.waitForTimeout(300);
  const addDebtBtn = page.locator('button', { hasText: 'Add debt' });
  await addDebtBtn.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/final-04b-debts-timeline-with-data.png`, fullPage: true });
  const timelinePresent = await page.evaluate(() => !!Array.from(document.querySelectorAll('span')).find((s) => s.textContent === 'Payoff Timeline'));
  console.log('DEBT_TIMELINE_PRESENT_WITH_DATA', timelinePresent);

  // ---- Add a real savings goal to exercise the ring view toggle ----
  await goTab(page, 'upcoming');
  await page.waitForTimeout(400);
  const addGoalBtn = page.locator('button', { hasText: 'Add goal' });
  if (await addGoalBtn.count() > 0) {
    await addGoalBtn.click();
    await page.waitForTimeout(300);
    await page.fill('input[placeholder*="Christmas"]', 'Test Goal');
    const targetAmountInput = page.locator('label:has-text("Target amount")').locator('xpath=following-sibling::div//input');
    await targetAmountInput.fill('1000').catch(() => {});
    await page.locator('button', { hasText: 'Add goal' }).last().click();
    await page.waitForTimeout(400);
    const ringToggle = page.locator('button[title*="ring view"]').first();
    if (await ringToggle.count() > 0) {
      await ringToggle.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/final-08b-savings-ring-view.png`, fullPage: false });
      console.log('RING_VIEW_TOGGLED', true);
    } else {
      console.log('RING_TOGGLE_NOT_FOUND');
    }
  }

  console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
  await browser.close();
})();
