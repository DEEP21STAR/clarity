import { chromium } from 'playwright';
const URL = 'http://localhost:4173';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);

  const dashBtn = page.locator('nav button', { hasText: 'Dashboard' }).first();
  await dashBtn.click();
  await page.waitForTimeout(1200);

  // Click the camera "copy as image" icon on the Financial Health Score card
  const healthCard = page.locator('text=Financial Health Score').locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
  const copyBtn = healthCard.locator('[data-copy-btn]');
  await copyBtn.click();
  await page.waitForTimeout(1500);

  const clipboardCheck = await page.evaluate(async () => {
    try {
      const items = await navigator.clipboard.read();
      const types = items.map((i) => i.types);
      let byteLength = null;
      if (items[0]?.types.includes('image/png')) {
        const blob = await items[0].getType('image/png');
        byteLength = blob.size;
      }
      return { types, byteLength };
    } catch (e) {
      return { error: String(e) };
    }
  });
  console.log('CLIPBOARD CHECK:', JSON.stringify(clipboardCheck));

  await page.screenshot({ path: '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad/r21-copy-image-state.png' });

  await browser.close();
})();
