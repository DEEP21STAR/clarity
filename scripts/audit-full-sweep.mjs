import { chromium } from 'playwright';
const URL = 'http://localhost:4173';
const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad/audit';
import { mkdirSync } from 'fs';
mkdirSync(OUT, { recursive: true });

const TABS = ['Dashboard', 'Upcoming Payments', 'Net Worth', 'Calendar', 'Transactions', 'Budgets', 'Debts', 'Shopping & Expenses', 'Tools'];

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
  await page.waitForTimeout(1000);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errorsByTab = {};
  let currentTab = 'boot';
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errorsByTab[currentTab] = errorsByTab[currentTab] || [];
      errorsByTab[currentTab].push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    errorsByTab[currentTab] = errorsByTab[currentTab] || [];
    errorsByTab[currentTab].push(String(err));
  });

  await unlock(page);

  for (const tab of TABS) {
    currentTab = tab;
    await clickTab(page, tab);
    const safeName = tab.toLowerCase().replace(/[^a-z]+/g, '-');
    await page.screenshot({ path: `${OUT}/sweep-${safeName}.png`, timeout: 30000 }).catch((e) => console.log(`SCREENSHOT FAILED for ${tab}:`, e.message));
  }

  // Household toggle spot-check on Dashboard + Upcoming Payments (most household-sensitive tabs)
  for (const view of ['Deep', 'Mimi', 'Combined']) {
    currentTab = `household-${view}`;
    await clickTab(page, 'Dashboard');
    await page.evaluate((v) => {
      const el = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === v);
      el?.click();
    }, view);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/sweep-household-${view.toLowerCase()}-dashboard.png`, timeout: 30000 }).catch(() => {});
  }

  // Personal/Business toggle on Dashboard + Tools
  for (const mode of ['Personal', 'Business']) {
    currentTab = `mode-${mode}`;
    await clickTab(page, 'Dashboard');
    await page.evaluate((m) => {
      const el = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === m);
      el?.click();
    }, mode);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/sweep-mode-${mode.toLowerCase()}-dashboard.png`, timeout: 30000 }).catch(() => {});
  }

  // NZ/AU toggle on Dashboard
  for (const country of ['NZ', 'AU']) {
    currentTab = `country-${country}`;
    await clickTab(page, 'Dashboard');
    await page.evaluate((c) => {
      const el = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === c);
      el?.click();
    }, country);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/sweep-country-${country.toLowerCase()}-dashboard.png`, timeout: 30000 }).catch(() => {});
  }

  console.log('ERRORS BY TAB/STATE:', JSON.stringify(errorsByTab, null, 2));
  await browser.close();
})();
