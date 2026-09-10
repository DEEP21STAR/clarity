import { chromium } from 'playwright';
const URL = 'http://localhost:4173';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 900 }, isMobile: true, hasTouch: true });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('nav button')).find((b) => b.textContent.trim().includes('Shopping & Expenses'));
    el?.click();
  });
  await page.waitForTimeout(900);

  const report = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const results = [];
    // Walk every element, find any whose right edge exceeds the viewport.
    document.querySelectorAll('body *').forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.right > vw + 2 && rect.width > 0) {
        results.push({
          tag: el.tagName,
          cls: (el.className || '').toString().slice(0, 120),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          left: Math.round(rect.left),
        });
      }
    });
    // Sort by how far right they extend, most offending first, top 15
    results.sort((a, b) => b.right - a.right);
    return { vw, offenders: results.slice(0, 15) };
  });
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})();
