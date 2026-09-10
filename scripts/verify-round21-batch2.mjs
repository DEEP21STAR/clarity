import { chromium } from 'playwright';
const URL = 'http://localhost:4173';
const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';

async function unlock(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));

  await unlock(page);

  // ===== 1. Preview grow-on-hover (using data-testid this time) =====
  await page.locator('nav button', { hasText: 'Dashboard' }).first().click();
  await page.waitForTimeout(1500);
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await page.waitForTimeout(300);
  await page.keyboard.type('dash');
  await page.waitForTimeout(200);
  const row = page.locator('button:has-text("Go to Dashboard")').first();
  await row.hover();
  await page.waitForTimeout(30);
  const previewEl = page.locator('[data-testid="cmdk-preview"]');
  const earlyBox = await previewEl.boundingBox().catch(() => null);
  await page.waitForTimeout(500);
  const grownBox = await previewEl.boundingBox().catch(() => null);
  await page.screenshot({ path: `${OUT}/b2-preview-grown.png` });
  console.log('1. PREVIEW early width ~30ms:', earlyBox?.width, '-> grown width ~530ms:', grownBox?.width);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ===== 2. Date formatting — check today (11 Sep 2026) renders day-first everywhere =====
  await page.locator('nav button', { hasText: 'Upcoming Payments' }).first().click();
  await page.waitForTimeout(800);
  const dueBadgeText = await page.locator('text=/17 Sep/').first().textContent().catch(() => null);
  console.log('2a. Due badge date (word format, unambiguous):', dueBadgeText);
  // Native date input read-out caption
  await page.locator('button:has-text("Record a payment")').first().click().catch(() => {});
  await page.waitForTimeout(300);
  const numericCaption = await page.locator('text=/^\\d{2}\\/\\d{2}\\/\\d{4}$/').first().textContent().catch(() => null);
  console.log('2b. DD/MM/YYYY read-out caption near a date input:', numericCaption);

  // ===== 3. Debts tab real GEM VISA balances =====
  await page.locator('nav button', { hasText: 'Debts' }).first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/b2-debts-full.png`, fullPage: true });
  const totalDebtText = await page.locator('text=Total Debt').locator('xpath=following::div[1]').first().textContent();
  console.log('3. Total Debt figure:', totalDebtText);
  const linkedRows = await page.locator('svg.lucide-link-2').count();
  console.log('3b. Card-linked debt rows shown (Link2 icon count):', linkedRows);

  // ===== 4. Transactions auto-categorization =====
  await page.locator('nav button', { hasText: 'Transactions' }).first().click();
  await page.waitForTimeout(800);
  // Import a small synthetic CSV with real merchant-shaped descriptions
  const csv = 'Date,Description,Amount\n2026-09-01,AMPOL FOODARY HAMILTON,-65.40\n2026-09-02,WOOLWORTHS METRO 1234,-142.10\n2026-09-03,KFC PAPATOETOE,-18.90\n2026-09-04,SALARY PAYMENT,3200.00\n2026-09-05,XYZ MYSTERY MERCHANT 991,-40.00\n';
  const buffer = Buffer.from(csv, 'utf-8');
  await page.setInputFiles('input[type="file"]', { name: 'test.csv', mimeType: 'text/csv', buffer });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/b2-transactions-categorized.png`, fullPage: true });
  const categories = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    return rows.slice(0, 6).map((r) => r.querySelector('td:nth-child(2)')?.textContent?.trim());
  });
  console.log('4. First few row categories after import:', JSON.stringify(categories));

  console.log('CONSOLE ERRORS:', errors.length ? errors.slice(0, 20) : 'none');
  await browser.close();
})();
