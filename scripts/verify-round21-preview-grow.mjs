import { chromium } from 'playwright';
const URL = 'http://localhost:4173';
const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);

  // Visit Dashboard once so its thumbnail is real (avoid the "No preview yet" state clouding the size check)
  await page.locator('nav button', { hasText: 'Dashboard' }).first().click();
  await page.waitForTimeout(1500);

  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await page.waitForTimeout(300);
  await page.keyboard.type('dash');
  await page.waitForTimeout(200);

  const row = page.locator('button:has-text("Go to Dashboard")').first();
  await row.hover();

  // Capture width almost immediately (small/pop-in state) and after the grow transition settles.
  await page.waitForTimeout(30);
  const previewLocator = page.locator('.command-preview-pop, [class*="w-64"][class*="rounded-xl"]').first();
  const earlyBox = await previewLocator.boundingBox().catch(() => null);
  await page.screenshot({ path: `${OUT}/r21g-preview-small.png` });

  await page.waitForTimeout(450); // past the 60ms trigger + 300ms transition
  const grownBox = await previewLocator.boundingBox().catch(() => null);
  await page.screenshot({ path: `${OUT}/r21g-preview-grown.png` });

  console.log('EARLY WIDTH (~30ms after hover):', earlyBox?.width);
  console.log('GROWN WIDTH (~480ms after hover):', grownBox?.width);

  // Now move mouse away and confirm it shrinks visibly before disappearing.
  await page.mouse.move(50, 50);
  await page.waitForTimeout(80);
  const shrinkingBox = await previewLocator.boundingBox().catch(() => null);
  console.log('MID-SHRINK WIDTH (~80ms after mouseout):', shrinkingBox?.width);
  await page.waitForTimeout(300);
  const goneBox = await previewLocator.boundingBox().catch(() => null);
  console.log('AFTER EXIT (should be null/gone):', goneBox);

  await browser.close();
})();
