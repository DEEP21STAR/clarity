import { chromium } from 'playwright';
const URL = 'http://localhost:4173';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('nav button', { hasText: 'Dashboard' }).first().click();
  await page.waitForTimeout(1500);

  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await page.waitForTimeout(300);
  await page.keyboard.type('dash');
  await page.waitForTimeout(200);
  await page.locator('button:has-text("Go to Dashboard")').first().hover();
  await page.waitForTimeout(800);

  const debug = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="cmdk-preview"]');
    const parent = el?.parentElement;
    const grandparent = parent?.parentElement;
    const cs = el ? getComputedStyle(el) : null;
    const img = el?.querySelector('img');
    return {
      elWidth: cs?.width,
      elFlexShrink: cs?.flexShrink,
      elFlexBasis: cs?.flexBasis,
      elFlexGrow: cs?.flexGrow,
      elMaxWidth: cs?.maxWidth,
      elBoxSizing: cs?.boxSizing,
      elDisplay: cs?.display,
      parentClass: parent?.className,
      parentDisplay: parent ? getComputedStyle(parent).display : null,
      parentWidth: parent ? getComputedStyle(parent).width : null,
      grandparentClass: grandparent?.className,
      grandparentWidth: grandparent ? getComputedStyle(grandparent).width : null,
      imgWidth: img ? getComputedStyle(img).width : null,
      imgSrcLen: img?.getAttribute('src')?.length,
    };
  });
  console.log(JSON.stringify(debug, null, 2));
  await browser.close();
})();
