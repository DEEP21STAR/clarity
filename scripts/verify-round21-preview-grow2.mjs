import { chromium } from 'playwright';
const URL = 'http://localhost:4173';
const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
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

  const samples = [];
  for (const wait of [20, 100, 200, 300, 400, 600, 800]) {
    await page.waitForTimeout(wait - (samples.length ? [20,100,200,300,400,600,800][samples.length-1] : 0));
    const w = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="cmdk-preview"]');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { computedWidth: cs.width, className: el.className, rectWidth: el.getBoundingClientRect().width };
    });
    samples.push({ t: wait, ...w });
  }
  console.log(JSON.stringify(samples, null, 2));
  await page.screenshot({ path: `${OUT}/b2-preview-grown-final.png` });
  await browser.close();
})();
