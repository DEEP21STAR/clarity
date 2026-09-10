import { chromium } from 'playwright';
const URL = 'http://localhost:4173';
const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad/audit';
import { mkdirSync } from 'fs';
mkdirSync(OUT, { recursive: true });

const TABS = ['Dashboard', 'Upcoming Payments', 'Net Worth', 'Calendar', 'Transactions', 'Budgets', 'Debts', 'Shopping & Expenses', 'Tools'];
const WIDTHS = [375, 390, 428];

async function unlock(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function clickTab(page, name) {
  await page.evaluate((n) => {
    const el = Array.from(document.querySelectorAll('nav button')).find((b) => b.textContent.trim().includes(n));
    el?.click();
  }, name);
  await page.waitForTimeout(900);
}

(async () => {
  const browser = await chromium.launch();
  const overflowReport = [];

  // Full pass at 375px (narrowest, highest risk) across all 9 tabs.
  {
    const page = await browser.newPage({ viewport: { width: 375, height: 900 }, isMobile: true, hasTouch: true });
    await unlock(page);
    for (const tab of TABS) {
      await clickTab(page, tab);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      if (overflow.scrollWidth > overflow.clientWidth + 2) {
        overflowReport.push({ width: 375, tab, ...overflow });
      }
      const safeName = tab.toLowerCase().replace(/[^a-z]+/g, '-');
      await page.screenshot({ path: `${OUT}/mobile-375-${safeName}.png`, timeout: 30000 }).catch((e) => console.log(`SCREENSHOT FAILED 375 ${tab}:`, e.message));
    }
    await page.close();
  }

  // Spot-check 390 and 428 on the 3 densest tabs.
  for (const width of [390, 428]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: true, hasTouch: true });
    await unlock(page);
    for (const tab of ['Dashboard', 'Upcoming Payments', 'Debts']) {
      await clickTab(page, tab);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      if (overflow.scrollWidth > overflow.clientWidth + 2) {
        overflowReport.push({ width, tab, ...overflow });
      }
      const safeName = tab.toLowerCase().replace(/[^a-z]+/g, '-');
      await page.screenshot({ path: `${OUT}/mobile-${width}-${safeName}.png`, timeout: 30000 }).catch((e) => console.log(`SCREENSHOT FAILED ${width} ${tab}:`, e.message));
    }
    await page.close();
  }

  console.log('HORIZONTAL OVERFLOW DETECTED:', overflowReport.length ? JSON.stringify(overflowReport, null, 2) : 'none — no tab/width overflowed the viewport');
  await browser.close();
})();
