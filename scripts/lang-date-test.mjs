import { chromium } from 'playwright';
const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 500, height: 300 }, locale: 'en-US' });
  await page.goto(`file://${OUT}/date-lang-test.html`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/date-lang-test.png` });
  await browser.close();
})();
