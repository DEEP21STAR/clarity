import { chromium } from 'playwright';

const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';
const URL = 'http://localhost:4173';

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

  // We're on Upcoming Payments by default — scope everything to the GEM VISA Deep card
  // specifically (the page has many other number inputs; an unscoped locator would grab
  // the wrong one).
  const cardHeading = page.locator('span', { hasText: 'GEM VISA Deep' }).first();
  await cardHeading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const cardContainer = page.locator('div.label-cut', { has: page.locator('span.label-tab', { hasText: 'GEM VISA Deep' }) }).first();

  // Real due-date badge check
  const badgeInfo = await page.evaluate(() => {
    const badges = Array.from(document.querySelectorAll('span')).filter((s) => /due in|overdue|due today|due tomorrow/.test(s.textContent || ''));
    return badges.slice(0, 3).map((b) => b.textContent);
  });
  console.log('DUE_BADGE_TEXT_SAMPLE', JSON.stringify(badgeInfo));

  await page.screenshot({ path: `${OUT}/r20-gemvisa-card-before.png`, fullPage: false });

  // Balance before
  const balanceBefore = await page.evaluate(() => {
    const label = Array.from(document.querySelectorAll('div')).find((d) => d.textContent?.trim() === 'Balance');
    return label?.nextElementSibling?.textContent;
  });
  console.log('BALANCE_BEFORE', balanceBefore);

  // Click "Record a payment" SCOPED to the GEM VISA Deep card
  const recordBtn = cardContainer.locator('button', { hasText: 'Record a payment' }).first();
  await recordBtn.click();
  await page.waitForTimeout(300);
  const amountInput = cardContainer.locator('input[type="number"]').first();
  await amountInput.fill('325');
  await page.screenshot({ path: `${OUT}/r20-record-payment-form.png`, fullPage: false });

  const recordConfirm = cardContainer.locator('button', { hasText: 'Record' }).first();
  await recordConfirm.click();
  await page.waitForTimeout(400);

  const balanceAfter = await page.evaluate(() => {
    const label = Array.from(document.querySelectorAll('div')).find((d) => d.textContent?.trim() === 'Balance');
    return label?.nextElementSibling?.textContent;
  });
  console.log('BALANCE_AFTER', balanceAfter);

  await page.screenshot({ path: `${OUT}/r20-after-payment-toast.png`, fullPage: false });

  // Now go check Payment History in Tools
  for (const t of await page.$$('nav button, header button, [class*="nav-tab"]')) {
    const txt = (await t.textContent())?.trim();
    if (txt && /tools/i.test(txt)) { await t.click(); break; }
  }
  await page.waitForTimeout(600);
  const historyHeading = page.locator('span', { hasText: 'Payment History' }).first();
  await historyHeading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/r20-payment-history.png`, fullPage: false });

  const historyText = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('p')).find((p) => /payment.*recorded/i.test(p.textContent || ''));
    return el?.textContent;
  });
  console.log('HISTORY_SUMMARY_TEXT', historyText);

  // Test the filter
  const select = page.locator('select').last();
  await select.selectOption({ label: 'GEM VISA Deep' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/r20-payment-history-filtered.png`, fullPage: false });
  const filteredCount = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('p')).find((p) => /match/.test(p.textContent || ''));
    return el?.textContent;
  });
  console.log('FILTERED_TEXT', filteredCount);

  // Label readability check
  const labelInfo = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.label-tab')).find((s) => /GEM VISA/i.test(s.textContent || ''));
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { text: el.textContent, fontSize: cs.fontSize, fontWeight: cs.fontWeight, textShadow: cs.textShadow };
  });
  console.log('LABEL_INFO', JSON.stringify(labelInfo));

  console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
  await browser.close();
})();
