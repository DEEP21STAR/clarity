import { chromium } from 'playwright';
const URL = 'http://localhost:4173';
const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';

async function unlock(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // === Field 1: Tools -> One-Off Entries date field ===
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    page.on('pageerror', (e) => errors.push('tools: ' + String(e)));
    await unlock(page);
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('nav button')).find((b) => b.textContent.includes('Tools'));
      el?.click();
    });
    await page.waitForTimeout(1000);
    const count = await page.locator('input[type="date"]').count();
    console.log('Tools tab date input count:', count);
    if (count > 0) {
      const box = await page.locator('input[type="date"]').first().boundingBox();
      await page.screenshot({ path: `${OUT}/datefield-2-tools-oneoff.png`, clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: 300, height: 70 } });
      const domCheck = await page.evaluate(() => {
        const input = document.querySelector('input[type="date"]');
        const wrapper = input.parentElement;
        const overlay = wrapper.querySelector('span');
        return {
          inputColor: getComputedStyle(input).color,
          inputColorScheme: getComputedStyle(input).colorScheme,
          overlayText: overlay?.textContent,
          overlayPointerEvents: overlay ? getComputedStyle(overlay).pointerEvents : null,
        };
      });
      console.log('Tools field DOM check:', JSON.stringify(domCheck));
    }
    await page.close();
  }

  // === Field 2: SavingsGoals "Add goal" date field ===
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    page.on('pageerror', (e) => errors.push('savingsgoal: ' + String(e)));
    await unlock(page);
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('nav button')).find((b) => b.textContent.includes('Upcoming Payments'));
      el?.click();
    });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Add goal');
      el?.click();
    });
    await page.waitForTimeout(500);
    const count = await page.locator('input[type="date"]').count();
    console.log('Savings goal form date input count:', count);
    if (count > 0) {
      await page.screenshot({ path: `${OUT}/datefield-3-savingsgoal.png` });
    }
    await page.close();
  }

  // === Field 3: RecordPaymentForm inline date field ===
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    page.on('pageerror', (e) => errors.push('recordpayment: ' + String(e)));
    await unlock(page);
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('nav button')).find((b) => b.textContent.includes('Upcoming Payments'));
      el?.click();
    });
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("Record a payment")').first().click({ force: true, timeout: 10000 });
    await page.waitForTimeout(500);
    const count = await page.locator('input[type="date"]').count();
    console.log('Record payment form date input count:', count);
    if (count > 0) {
      const box = await page.locator('input[type="date"]').first().boundingBox();
      await page.screenshot({ path: `${OUT}/datefield-1-recordpayment.png`, clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: 400, height: 60 } });

      // Functional check: does a real input event still change the value?
      const functionalCheck = await page.evaluate(async () => {
        const input = document.querySelector('input[type="date"]');
        const before = input.value;
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, '2026-12-25');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 150));
        const overlay = input.parentElement.querySelector('span');
        return { before, after: input.value, overlayAfter: overlay?.textContent };
      });
      console.log('FUNCTIONAL CHECK — real input event still updates value + overlay:', JSON.stringify(functionalCheck));
    }
    await page.close();
  }

  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})();
