import { chromium } from 'playwright';
const URL = 'http://localhost:4173';
const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);

  // Default active tab is already "upcoming" — no click needed.
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('span')).find((s) => s.textContent === 'GEM VISA Deep');
    el?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/rings-before.png`, timeout: 60000 });

  // Measure the GEM VISA Deep min-payment ring's dashoffset BEFORE any payment.
  const ringBefore = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('svg'));
    // Grab the min-payment ring specifically: it's the small 44px one inside the "Min Payment" cell.
    const label = Array.from(document.querySelectorAll('div')).find((d) => d.textContent === 'Min Payment');
    const ring = label?.parentElement?.querySelector('circle[stroke-dashoffset]:nth-of-type(2)');
    return ring ? ring.getAttribute('stroke-dashoffset') : null;
  });
  console.log('Min-payment ring dashoffset BEFORE payment:', ringBefore);

  // Record a real $325 payment against GEM VISA Deep (Deep's real case) — first "Record a payment" button under GEM VISA Deep.
  const gemDeepCard = page.locator('text=GEM VISA Deep').first().locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
  await gemDeepCard.locator('button:has-text("Record a payment")').first().click({ force: true });
  await page.waitForTimeout(300);
  const amountInput = gemDeepCard.locator('input[type="number"]').first();
  await amountInput.fill('325');
  await gemDeepCard.locator('button:has-text("Record")').first().click({ force: true });
  await page.waitForTimeout(150); // mid-animation — GSAP rings run 0.9-1.1s
  await page.screenshot({ path: `${OUT}/rings-mid-animation.png`, timeout: 60000 });

  const ringMid = await page.evaluate(() => {
    const label = Array.from(document.querySelectorAll('div')).find((d) => d.textContent === 'Min Payment');
    const ring = label?.parentElement?.querySelector('circle[stroke-dashoffset]:nth-of-type(2)');
    return ring ? ring.getAttribute('stroke-dashoffset') : null;
  });
  console.log('Min-payment ring dashoffset MID-animation (~150ms after payment):', ringMid);

  await page.waitForTimeout(1200); // let it fully settle
  await page.screenshot({ path: `${OUT}/rings-settled.png`, timeout: 60000 });
  const ringAfter = await page.evaluate(() => {
    const label = Array.from(document.querySelectorAll('div')).find((d) => d.textContent === 'Min Payment');
    const ring = label?.parentElement?.querySelector('circle[stroke-dashoffset]:nth-of-type(2)');
    return ring ? ring.getAttribute('stroke-dashoffset') : null;
  });
  console.log('Min-payment ring dashoffset SETTLED (~1.5s after payment):', ringAfter);

  // Also check the "met" state text appears
  const metText = await page.locator('text=✓ Minimum payment met').count();
  console.log('Minimum payment met indicator present:', metText > 0);

  console.log('CONSOLE ERRORS:', errors.length ? errors.slice(0, 10) : 'none');
  await browser.close();
})();
