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

  // ---- Dashboard: Year in Review, drag-reorder ghost, health-score confetti trigger ----
  await goTab(page, 'dashboard');
  await page.screenshot({ path: `${OUT}/final-01-dashboard-full.png`, fullPage: true });
  const yearReviewPresent = await page.evaluate(() => !!Array.from(document.querySelectorAll('span')).find((s) => s.textContent === 'Year in Review'));
  console.log('YEAR_IN_REVIEW_PRESENT', yearReviewPresent);

  // ---- Transactions: category colours + live search + skeleton import ----
  await goTab(page, 'transactions');
  await page.waitForTimeout(300);
  const searchBox = page.locator('input[placeholder*="Search description"]');
  await searchBox.fill('gas');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/final-02-transactions-search.png`, fullPage: false });
  const highlightCount = await page.evaluate(() => document.querySelectorAll('mark.search-hit').length);
  console.log('SEARCH_HIGHLIGHT_MARKS', highlightCount);
  await searchBox.fill('');

  // ---- Budgets: donut explode + category trend + trend arrows ----
  await goTab(page, 'budgets');
  await page.waitForTimeout(300);
  const pieSlice = page.locator('path.recharts-sector').first();
  if (await pieSlice.count() > 0) {
    await pieSlice.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: `${OUT}/final-03-budgets-full.png`, fullPage: true });

  // ---- Debts: payoff timeline chart + illustrated empty state check via code ----
  await goTab(page, 'debts');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/final-04-debts-full.png`, fullPage: true });
  const timelinePresent = await page.evaluate(() => !!Array.from(document.querySelectorAll('span')).find((s) => s.textContent === 'Payoff Timeline'));
  console.log('DEBT_TIMELINE_PRESENT', timelinePresent);

  // ---- Net Worth: milestone flags, trend arrow ----
  await goTab(page, 'net worth');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/final-05-networth-full.png`, fullPage: true });

  // ---- Calendar: heatmap + slide transition + paid toggle ----
  await goTab(page, 'calendar');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/final-06-calendar-before.png`, fullPage: false });
  const nextBtn = page.locator('button').filter({ has: page.locator('svg') }).nth(1);
  // Click a real bill entry to mark paid
  const billBtn = page.locator('button', { hasText: /Rent|Gas|GEM/ }).first();
  if (await billBtn.count() > 0) {
    await billBtn.click();
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: `${OUT}/final-06b-calendar-after-paid-click.png`, fullPage: false });

  // ---- Tools: sound toggle, extra usage purchases, payment history ----
  await goTab(page, 'tools');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/final-07-tools-full.png`, fullPage: true });
  const soundToggle = page.locator('button', { hasText: /Sound (on|off)/ });
  console.log('SOUND_TOGGLE_PRESENT', await soundToggle.count());

  // ---- Savings goals ring view (Upcoming Payments tab) ----
  await goTab(page, 'upcoming');
  await page.waitForTimeout(300);
  const ringToggle = page.locator('button[title*="ring view"]').first();
  if (await ringToggle.count() > 0) {
    await ringToggle.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/final-08-savings-ring-view.png`, fullPage: false });
  } else {
    console.log('NO_SAVINGS_GOALS_TO_SHOW_RING');
  }

  // ---- Shopping cart animated icon ----
  await goTab(page, 'shopping');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/final-09-shopping.png`, fullPage: false });

  // ---- Reduced-motion check: reload with emulated reduced motion ----
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
  const reducedMotionCheck = await page.evaluate(() => {
    const aurora = document.querySelector('.aurora-bg');
    const auroraAnim = aurora ? getComputedStyle(aurora).animationName : null;
    const navTab = document.querySelector('.nav-tab-active');
    const navAnim = navTab ? getComputedStyle(navTab).animationName : null;
    return { auroraAnim, navAnim, matchMediaReduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches };
  });
  console.log('REDUCED_MOTION_CHECK', JSON.stringify(reducedMotionCheck));
  await page.screenshot({ path: `${OUT}/final-10-reduced-motion.png`, fullPage: false });

  console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
  await browser.close();
})();
