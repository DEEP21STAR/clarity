import { chromium } from 'playwright';

const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';
const URL = 'http://localhost:4173';

async function unlock(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function goToTab(page, label) {
  const btn = page.locator('nav button', { hasText: label }).first();
  await btn.click();
  await page.waitForTimeout(700);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));

  await unlock(page);

  // 1. Dashboard tab — forecast card, tip of day, biggest bill spotlight, emergency fund runway
  await goToTab(page, 'Dashboard');
  await page.waitForTimeout(1200); // let entrance animations + thumbnail capture settle
  await page.screenshot({ path: `${OUT}/r21-dashboard-full.png`, fullPage: true });
  const forecastCard = await page.locator('text=14-Day Cash Forecast').count();
  const tipOfDay = await page.locator('text=/KiwiSaver|ATO|sinking fund|avalanche|ACC earner|installment plan|round-up|LITO|emergency fund|subscriptions|GST|balance to \\$0/i').count();
  console.log('CHECK forecastCard present:', forecastCard > 0);
  console.log('CHECK tipOfDay present:', tipOfDay > 0);

  // 2. Emergency fund runway + biggest bill spotlight (scroll to insights/health blocks)
  const efRunway = await page.locator('text=/Savings alone cover fixed bills until/').count();
  const biggestBill = await page.locator('text=/Biggest bill coming up/').count();
  console.log('CHECK emergency fund runway line present:', efRunway > 0);
  console.log('CHECK biggest upcoming bill spotlight present:', biggestBill > 0);

  // 3. Keyboard reorder buttons present
  const reorderBtns = await page.locator('[aria-label*="Move"]').count();
  console.log('CHECK dashboard keyboard reorder buttons present:', reorderBtns > 0, reorderBtns);

  // 4. Header: online status (should be online, no badge), saved indicator element exists in DOM
  const offlineBadge = await page.locator('text=Offline').count();
  console.log('CHECK offline badge hidden while online:', offlineBadge === 0);

  // 5. CommandPalette — open, check shortcuts hint, recently-used sort default, fuzzy search
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/r21-palette-open.png` });
  await page.keyboard.type('dash');
  await page.waitForTimeout(300);
  const fuzzyResult = await page.locator('text=Go to Dashboard').count();
  console.log('CHECK fuzzy search "dash" finds "Go to Dashboard":', fuzzyResult > 0);
  // hover the first result to trigger thumbnail preview
  const firstResult = page.locator('button:has-text("Go to Dashboard")').first();
  await firstResult.hover();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/r21-palette-hover-preview.png` });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);

  // 6. Shortcuts cheatsheet via "?"
  await page.keyboard.press('?');
  await page.waitForTimeout(300);
  const cheatsheet = await page.locator('text=Keyboard shortcuts').count();
  console.log('CHECK shortcuts cheatsheet opens on "?":', cheatsheet > 0);
  await page.screenshot({ path: `${OUT}/r21-shortcuts-cheatsheet.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 7. Transactions — delete row, bulk recategorize, export, "/" focus
  await goToTab(page, 'Transactions');
  // Import a tiny CSV via the file input isn't easy headlessly without a real file; instead
  // check that the empty/ledger UI renders without errors, and that "/" focuses search.
  await page.keyboard.press('/');
  await page.waitForTimeout(200);
  const searchFocused = await page.evaluate(() => document.activeElement?.getAttribute('placeholder'));
  console.log('CHECK "/" focuses transactions search:', searchFocused?.includes('Search'));
  await page.screenshot({ path: `${OUT}/r21-transactions.png` });

  // 8. Upcoming Payments — device repayment add/edit/remove
  await goToTab(page, 'Upcoming Payments');
  const addDeviceBtn = page.locator('button:has-text("Add device repayment")');
  console.log('CHECK "Add device repayment" button present:', await addDeviceBtn.count() > 0);
  await addDeviceBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/r21-device-repayments.png` });

  // 9. Debts — debt-free calendar date sub-caption
  await goToTab(page, 'Debts');
  await page.screenshot({ path: `${OUT}/r21-debts.png` });
  const debtFreeDate = await page.locator('text=/at this pace/').count();
  console.log('CHECK debt-free calendar date caption present (only if debts exist):', debtFreeDate);

  // 10. Tools — Data Health Check panel
  await goToTab(page, 'Tools');
  await page.screenshot({ path: `${OUT}/r21-tools-health-check.png`, fullPage: true });
  const healthCheckPanel = await page.locator('text=Data Health Check').count();
  console.log('CHECK Data Health Check panel present:', healthCheckPanel > 0);

  console.log('CONSOLE ERRORS:', errors.length ? errors.slice(0, 20) : 'none');

  await browser.close();
})();
