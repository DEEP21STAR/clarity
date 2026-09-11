import { chromium } from 'playwright';
const URL = 'http://localhost:4173';
const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);

  // 1. RecordPaymentForm date field (Upcoming Payments -> Record a payment)
  await page.locator('button:has-text("Record a payment")').first().click({ force: true });
  await page.waitForTimeout(400);
  const recordFormBox = await page.locator('input[type="date"]').first().locator('xpath=..').boundingBox();
  await page.screenshot({ path: `${OUT}/datefield-1-recordpayment.png`, clip: { x: recordFormBox.x - 10, y: recordFormBox.y - 40, width: 500, height: 90 } });

  // 2. Tools -> One-Off Entries date field
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('nav button')).find((b) => b.textContent.includes('Tools'));
    el?.click();
  });
  await page.waitForTimeout(800);
  const toolsDateInput = page.locator('input[type="date"]').first();
  const toolsBox = await toolsDateInput.boundingBox();
  await page.screenshot({ path: `${OUT}/datefield-2-tools-oneoff.png`, clip: { x: toolsBox.x - 10, y: toolsBox.y - 10, width: 300, height: 70 } });

  // 3. SavingsGoals date field (Upcoming Payments -> Savings Goals -> Add goal)
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('nav button')).find((b) => b.textContent.includes('Upcoming Payments'));
    el?.click();
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Add goal');
    el?.click();
  });
  await page.waitForTimeout(500);
  const goalDateBox = await page.locator('input[type="date"]').first().boundingBox();
  await page.screenshot({ path: `${OUT}/datefield-3-savingsgoal.png`, clip: { x: goalDateBox.x - 10, y: goalDateBox.y - 40, width: 300, height: 90 } });

  // Confirm each shows exactly ONE date, DD/MM/YYYY, via real DOM inspection (not just visual)
  const domCheck = await page.evaluate(() => {
    const wrapper = document.querySelector('input[type="date"]')?.parentElement;
    if (!wrapper) return null;
    const input = wrapper.querySelector('input[type="date"]');
    const overlay = wrapper.querySelector('span');
    return {
      inputColor: getComputedStyle(input).color,
      inputColorScheme: getComputedStyle(input).colorScheme,
      overlayText: overlay?.textContent,
      overlayPointerEvents: overlay ? getComputedStyle(overlay).pointerEvents : null,
    };
  });
  console.log('DOM CHECK (single date field):', JSON.stringify(domCheck));

  // Confirm clicking still fires real onChange (functional, not just decorative)
  const functionalCheck = await page.evaluate(async () => {
    const input = document.querySelector('input[type="date"]');
    const before = input.value;
    // Simulate a real value change + native input event, same as picking a date in the OS picker
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(input, '2026-12-25');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 100));
    return { before, after: input.value };
  });
  console.log('FUNCTIONAL CHECK (value actually changes via real input event):', JSON.stringify(functionalCheck));
  await page.waitForTimeout(200);
  const afterChangeOverlay = await page.evaluate(() => document.querySelector('input[type="date"]')?.parentElement?.querySelector('span')?.textContent);
  console.log('Overlay text after simulated real date change (should be 25/12/2026):', afterChangeOverlay);

  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})();
