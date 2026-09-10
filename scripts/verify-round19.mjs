import { chromium } from 'playwright';

const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';
const URL = 'http://localhost:4173';

async function unlockPin(page) {
  for (const d of ['6', '3', '0', '4']) {
    await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  }
  await page.waitForTimeout(500);
}

function relLum(hex) {
  const c = hex.match(/#?(\w\w)(\w\w)(\w\w)/);
  const [r, g, b] = [c[1], c[2], c[3]].map((h) => {
    let v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(hexA, hexB) {
  const l1 = relLum(hexA), l2 = relLum(hexB);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await unlockPin(page);
  await page.waitForTimeout(800);

  // Go to Dashboard first (default tab is Upcoming)
  const dashBtn = page.locator('button[data-tab="dashboard"]');
  if (await dashBtn.count() > 0) { await dashBtn.click(); await page.waitForTimeout(600); }

  // ===================== FIX 5: headline typography =====================
  await page.screenshot({ path: `${OUT}/r19-05-headline-AFTER.png`, clip: { x: 140, y: 130, width: 1160, height: 90 } });
  const headlineInfo = await page.evaluate(() => {
    const p = Array.from(document.querySelectorAll('p')).find((el) => /ahead|behind/.test(el.textContent || ''));
    if (!p) return null;
    const cs = getComputedStyle(p);
    const spans = Array.from(p.querySelectorAll('span'));
    const highlighted = spans.filter((s) => s.className.includes('gradient-heading'));
    return {
      text: p.textContent,
      color: cs.color,
      fontWeight: cs.fontWeight,
      fontSize: cs.fontSize,
      highlightedCount: highlighted.length,
      highlightedTexts: highlighted.map((s) => s.textContent),
    };
  });
  console.log('HEADLINE_INFO', JSON.stringify(headlineInfo));

  // ===================== FIX 4: insights ticker =====================
  const tickerInfo = await page.evaluate(() => {
    const wrap = document.querySelector('.ticker-wrap');
    if (!wrap) return null;
    const cs = getComputedStyle(wrap);
    const track = wrap.querySelector('.ticker-track');
    const trackCs = track ? getComputedStyle(track) : null;
    const icons = wrap.querySelectorAll('svg');
    const iconWraps = wrap.querySelectorAll('span[class*="rounded-full"]');
    return {
      borderColor: cs.borderColor,
      boxShadow: cs.boxShadow.slice(0, 80),
      animationDuration: trackCs ? trackCs.animationDuration : null,
      iconCount: icons.length,
      iconWrapCount: iconWraps.length,
    };
  });
  console.log('TICKER_INFO', JSON.stringify(tickerInfo));
  await page.screenshot({ path: `${OUT}/r19-04-ticker-AFTER.png`, clip: { x: 140, y: 220, width: 1160, height: 60 } });

  // ===================== FIX 3: quick actions hint =====================
  const hintInfo = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => /quick actions/i.test(b.textContent || ''));
    if (!btn) return null;
    return { text: btn.textContent, title: btn.getAttribute('title'), tag: btn.tagName };
  });
  console.log('HINT_INFO', JSON.stringify(hintInfo));
  // Click it and confirm it actually opens the palette
  const hintBtn = page.locator('button', { hasText: 'Quick actions' });
  await hintBtn.click();
  await page.waitForTimeout(300);
  const paletteOpen = await page.evaluate(() => !!document.querySelector('input[placeholder*="Jump to"]'));
  console.log('PALETTE_OPENED_BY_HINT_CLICK', paletteOpen);
  await page.screenshot({ path: `${OUT}/r19-03-hint-click-opens-palette.png`, fullPage: false });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // ===================== FIX 2: segmented control contrast =====================
  await page.screenshot({ path: `${OUT}/r19-02-segmented-combined-AFTER.png`, clip: { x: 900, y: 8, width: 300, height: 45 } });
  const segContrast = await page.evaluate(() => {
    const tracks = Array.from(document.querySelectorAll('.segmented-track'));
    const track = tracks.find((t) => /Combined/.test(t.textContent || ''));
    if (!track) return null;
    const thumb = track.querySelector('.segmented-thumb');
    const combinedBtn = Array.from(track.querySelectorAll('button')).find((b) => /Combined/.test(b.textContent || ''));
    const thumbBg = thumb ? getComputedStyle(thumb).backgroundImage : null;
    const btnColor = combinedBtn ? getComputedStyle(combinedBtn).color : null;
    return { thumbBg, btnColor, combinedText: combinedBtn?.textContent };
  });
  console.log('SEGMENTED_CONTRAST_INFO', JSON.stringify(segContrast));
  // Compute real contrast ratios for the two gradient endpoints vs black text
  const c1 = contrast('#a5f3fc', '#000000');
  const c2 = contrast('#d8b4fe', '#000000');
  console.log('CONTRAST_RATIO_cyan200_vs_black', c1.toFixed(2), '(WCAG AA needs >=4.5, AAA >=7)');
  console.log('CONTRAST_RATIO_purple300_vs_black', c2.toFixed(2), '(WCAG AA needs >=4.5, AAA >=7)');

  // ===================== FIX 1: traffic-light due dates =====================
  // Recurring Bills table (Upcoming Payments tab)
  const upcomingTabs = await page.$$('nav button, header button, [class*="nav-tab"]');
  for (const t of upcomingTabs) {
    const txt = (await t.textContent())?.trim();
    if (txt && /upcoming/i.test(txt)) { await t.click(); break; }
  }
  await page.waitForTimeout(700);
  const showAllBtn = page.locator('text=/show all \\d+ bills/i').first();
  if (await showAllBtn.count() > 0) { await showAllBtn.scrollIntoViewIfNeeded(); await showAllBtn.click(); await page.waitForTimeout(500); }

  const dueBadgeInfo = await page.evaluate(() => {
    const badges = Array.from(document.querySelectorAll('span')).filter((s) => /due (today|tomorrow|in \d+ days)|overdue/.test(s.textContent || ''));
    return badges.map((b) => ({ text: b.textContent.trim(), className: b.className }));
  });
  console.log('DUE_BADGES_RECURRING_BILLS', JSON.stringify(dueBadgeInfo));
  await page.screenshot({ path: `${OUT}/r19-01-recurring-bills-traffic-light-AFTER.png`, fullPage: true });

  // GEM VISA min payment due badge
  const gemBadge = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('div')).filter((d) => d.textContent?.trim() === 'Min Payment');
    for (const h of headers) {
      const parent = h.parentElement;
      const badge = parent?.querySelector('span');
      if (badge) return { text: badge.textContent, className: badge.className };
    }
    return null;
  });
  console.log('GEM_VISA_MIN_PAYMENT_BADGE', JSON.stringify(gemBadge));

  // Periodic bill gauge (Gas) pending banner severity-driven color
  const periodicBanner = await page.evaluate(() => {
    const banners = Array.from(document.querySelectorAll('div')).filter((d) => /^Bill due/.test(d.textContent?.trim() || '') === false && d.textContent?.includes('Bill due'));
    const banner = banners.find((b) => b.className.includes('rounded-lg'));
    return banner ? { className: banner.className, text: banner.textContent.slice(0, 120) } : null;
  });
  console.log('PERIODIC_BILL_BANNER', JSON.stringify(periodicBanner));
  await page.screenshot({ path: `${OUT}/r19-01b-periodic-gauge-traffic-light-AFTER.png`, fullPage: false });

  // Bill calendar coloring
  for (const t of await page.$$('nav button, header button, [class*="nav-tab"]')) {
    const txt = (await t.textContent())?.trim();
    if (txt && /calendar/i.test(txt)) { await t.click(); break; }
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/r19-01c-calendar-traffic-light-AFTER.png`, fullPage: true });
  const calendarColors = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('[title*="due"]'));
    return cells.slice(0, 10).map((c) => ({ title: c.getAttribute('title'), className: c.className }));
  });
  console.log('CALENDAR_ENTRY_COLORS', JSON.stringify(calendarColors));

  console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));

  await browser.close();
})();
