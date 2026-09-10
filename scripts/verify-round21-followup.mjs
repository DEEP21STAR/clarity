import { chromium } from 'playwright';
const URL = 'http://localhost:4173';
const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);

  // 1. Nav bar DEFAULT state — tight crop of just the nav row
  const nav = page.locator('nav').first();
  await nav.screenshot({ path: `${OUT}/r21f-nav-default.png` });

  // Get computed style of a couple of inactive tabs' rest-state accent dot (::before) to prove
  // real per-tab colour, not just eyeballing.
  const restColors = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.nav-tab-inactive'));
    return buttons.slice(0, 3).map((b) => {
      const before = getComputedStyle(b, '::before');
      return { tab: b.getAttribute('data-tab'), dotColor: before.backgroundColor, dotOpacity: before.opacity };
    });
  });
  console.log('REST STATE DOT COLORS (first 3 inactive tabs):', JSON.stringify(restColors));

  // 2. Hover state on a specific inactive tab (Debts) — real screenshot + computed style diff
  const debtsTab = page.locator('[data-tab="debts"]');
  const beforeHoverColor = await debtsTab.evaluate((el) => getComputedStyle(el).color);
  await debtsTab.hover();
  await page.waitForTimeout(300);
  const afterHoverColor = await debtsTab.evaluate((el) => getComputedStyle(el).color);
  const afterHoverShadow = await debtsTab.evaluate((el) => getComputedStyle(el).boxShadow);
  console.log('DEBTS TAB color before hover:', beforeHoverColor);
  console.log('DEBTS TAB color AFTER hover:', afterHoverColor);
  console.log('DEBTS TAB box-shadow AFTER hover:', afterHoverShadow);
  await nav.screenshot({ path: `${OUT}/r21f-nav-hover-debts.png` });

  // Also hover Net Worth to show a DIFFERENT accent colour on hover (proves per-tab, not global)
  await page.locator('[data-tab="networth"]').hover();
  await page.waitForTimeout(300);
  const networthHoverColor = await page.locator('[data-tab="networth"]').evaluate((el) => getComputedStyle(el).color);
  console.log('NET WORTH TAB color AFTER hover:', networthHoverColor);
  await nav.screenshot({ path: `${OUT}/r21f-nav-hover-networth.png` });

  // 3. Wait for the precacher to work through all non-active tabs, then check localStorage
  // directly for thumbnails on tabs NEVER manually visited.
  console.log('Waiting ~14s for ThumbnailPrecacher to stagger through all tabs...');
  await page.waitForTimeout(14000);

  const cacheState = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('clarity:thumb:'));
    return keys.map((k) => ({ tab: k.replace('clarity:thumb:', ''), bytes: localStorage.getItem(k)?.length ?? 0 }));
  });
  console.log('CACHED THUMBNAILS AFTER PRECACHE WINDOW (fresh load, only "upcoming" was ever the visible tab):', JSON.stringify(cacheState, null, 2));

  console.log('CONSOLE ERRORS:', errors.length ? errors.slice(0, 20) : 'none');

  await browser.close();
})();
