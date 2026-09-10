import { chromium } from 'playwright';
const URL = 'http://localhost:4173';
const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad/audit';

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

  // === Edge case 1: negative Live Funds Available (HSBC very negative) ===
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (e) => errors.push('negLiveFunds: ' + String(e)));
    await unlock(page);
    await page.evaluate(() => {
      const raw = localStorage.getItem('clarity-dashboard-state-v5');
      const state = JSON.parse(raw);
      state.accounts = state.accounts.map((a) => a.id === 'hsbc' ? { ...a, value: -5000 } : a);
      localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('nav button')).find((b) => b.textContent.includes('Upcoming Payments'));
      el?.click();
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/edge-negative-live-funds.png`, timeout: 30000 }).catch(() => {});
    await page.close();
  }

  // === Edge case 2: a plan at exactly 0% and exactly 100% paid ===
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (e) => errors.push('planEdges: ' + String(e)));
    await unlock(page);
    await page.evaluate(() => {
      const raw = localStorage.getItem('clarity-dashboard-state-v5');
      const state = JSON.parse(raw);
      const card = state.creditCards.find((c) => c.id === 'card-gem-visa-deep');
      card.plans[0] = { ...card.plans[0], remaining: card.plans[0].total, monthsRemaining: card.plans[0].monthsTotal }; // exactly 0% paid
      card.plans[1] = { ...card.plans[1], remaining: 0 }; // exactly 100% paid
      localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('nav button')).find((b) => b.textContent.includes('Upcoming Payments'));
      el?.click();
    });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('span')).find((s) => s.textContent === 'GEM VISA Deep');
      el?.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/edge-plan-0-100-percent.png`, timeout: 30000 }).catch(() => {});
    await page.close();
  }

  // === Edge case 3: account with $0 everywhere (fresh seed already is this — re-confirm no crash) ===
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (e) => errors.push('allZero: ' + String(e)));
    await unlock(page);
    for (const tabName of ['Dashboard', 'Net Worth', 'Debts']) {
      await page.evaluate((n) => {
        const el = Array.from(document.querySelectorAll('nav button')).find((b) => b.textContent.includes(n));
        el?.click();
      }, tabName);
      await page.waitForTimeout(800);
    }
    await page.close();
  }

  // === Reduced motion re-check across rings/palette-grow/nav-hover ===
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await unlock(page);
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('nav button')).find((b) => b.textContent.includes('Upcoming Payments'));
      el?.click();
    });
    await page.waitForTimeout(1200);
    const ringCheck = await page.evaluate(() => {
      const circles = Array.from(document.querySelectorAll('circle[stroke-dashoffset]'));
      // Under reduced motion, RadialProgress should gsap.set() immediately to final value —
      // check that a ring exists and has a real (non-full-circumference) dashoffset already.
      return circles.slice(0, 3).map((c) => ({ offset: c.getAttribute('stroke-dashoffset'), dasharray: c.getAttribute('stroke-dasharray') }));
    });
    console.log('REDUCED MOTION — ring dashoffsets (should already be at real values, not full circumference):', JSON.stringify(ringCheck));

    // Nav icon hover — should have transition:none under reduced motion
    const navIconTransition = await page.evaluate(() => {
      const icon = document.querySelector('.nav-icon');
      return icon ? getComputedStyle(icon).transitionDuration : null;
    });
    console.log('REDUCED MOTION — .nav-icon transitionDuration (should be 0s):', navIconTransition);

    // Command palette preview — grown should be true immediately (no small->large animation)
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('nav button')).find((b) => b.textContent.includes('Dashboard'));
      el?.click();
    });
    await page.waitForTimeout(1200);
    await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
    await page.waitForTimeout(300);
    await page.keyboard.type('dash');
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Go to Dashboard")').first().hover();
    await page.waitForTimeout(50); // very early — under reduced motion should ALREADY be full width
    const previewWidth = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="cmdk-preview"]');
      return el ? getComputedStyle(el).width : null;
    });
    console.log('REDUCED MOTION — preview width at 50ms (should be 416px immediately, not mid-grow):', previewWidth);

    await page.close();
  }

  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})();
