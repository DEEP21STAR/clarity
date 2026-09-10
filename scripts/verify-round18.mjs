import { chromium } from 'playwright';

const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';
const URL = 'http://localhost:4173';

const consoleErrors = [];

async function unlockPin(page) {
  // PIN gate: 4-digit numpad, PIN=6304
  for (const d of ['6', '3', '0', '4']) {
    await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  }
  await page.waitForTimeout(500);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await unlockPin(page);
  await page.waitForTimeout(800);

  // Explicitly go to Dashboard tab (app default tab is 'upcoming', by design)
  const dashTabBtn = page.locator('button[data-tab="dashboard"]');
  if (await dashTabBtn.count() > 0) { await dashTabBtn.click(); await page.waitForTimeout(600); }

  // 1 & Full nav bar screenshot — gradient headings + nav tabs
  await page.screenshot({ path: `${OUT}/r18-01-navbar-dashboard.png`, fullPage: false });

  // Zoom on nav bar specifically
  const nav = await page.$('nav, header, [class*="nav"]');
  if (nav) await nav.screenshot({ path: `${OUT}/r18-02-navbar-zoom.png` }).catch(() => {});

  // Page heading gradient check — grab computed style of h2 on Dashboard
  const headingInfo = await page.evaluate(() => {
    const h = document.querySelector('h2.gradient-heading') || document.querySelector('h2');
    if (!h) return null;
    const cs = getComputedStyle(h);
    return { text: h.textContent, backgroundImage: cs.backgroundImage, webkitBackgroundClip: cs.getPropertyValue('-webkit-background-clip') || cs.getPropertyValue('background-clip'), color: cs.color, className: h.className };
  });
  console.log('HEADING_INFO', JSON.stringify(headingInfo));

  // Nav tab active-state check
  const navTabInfo = await page.evaluate(() => {
    const active = document.querySelector('.nav-tab-active, .nav-tab.nav-tab-active, [class*="nav-tab"][class*="active"]');
    if (!active) return null;
    const cs = getComputedStyle(active);
    return { text: active.textContent, className: active.className, backgroundImage: cs.backgroundImage };
  });
  console.log('NAV_TAB_ACTIVE_INFO', JSON.stringify(navTabInfo));

  // Nav icon check
  const navIconInfo = await page.evaluate(() => {
    const icons = Array.from(document.querySelectorAll('.nav-icon'));
    return { count: icons.length, firstClass: icons[0]?.getAttribute('class') };
  });
  console.log('NAV_ICON_INFO', JSON.stringify(navIconInfo));

  // Headline + ticker on Dashboard
  const headlineText = await page.evaluate(() => {
    const p = Array.from(document.querySelectorAll('p')).find((el) => /ahead|behind/.test(el.textContent || ''));
    return p ? p.textContent : null;
  });
  console.log('HEADLINE_TEXT', headlineText);

  const tickerInfo = await page.evaluate(() => {
    const el = document.querySelector('.ticker-track, .ticker-wrap');
    return el ? { text: el.textContent?.slice(0, 300), className: el.className } : null;
  });
  console.log('TICKER_INFO', JSON.stringify(tickerInfo));

  await page.screenshot({ path: `${OUT}/r18-03-dashboard-headline-ticker.png`, fullPage: false });

  // Glassmorphism panel check
  const glassInfo = await page.evaluate(() => {
    const el = document.querySelector('.glass-panel');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { backdropFilter: cs.backdropFilter || cs.getPropertyValue('-webkit-backdrop-filter'), background: cs.background.slice(0, 100) };
  });
  console.log('GLASS_INFO', JSON.stringify(glassInfo));

  // Drag handle presence
  const dragInfo = await page.evaluate(() => {
    const handles = document.querySelectorAll('.drag-handle');
    const draggables = document.querySelectorAll('[draggable="true"]');
    return { handles: handles.length, draggables: draggables.length };
  });
  console.log('DRAG_INFO', JSON.stringify(dragInfo));

  // Full page scroll screenshot of dashboard with disclosures
  await page.screenshot({ path: `${OUT}/r18-04-dashboard-full.png`, fullPage: true });

  // --- Drag-reorder test: swap the first two draggable blocks, confirm order actually changes and persists across reload ---
  const orderBefore = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('clarity-state') || localStorage.getItem('clarity-dashboard-state') || '{}').dashboardCardOrder ?? null; } catch { return 'PARSE_ERR'; }
  });
  console.log('ORDER_BEFORE_RAW', JSON.stringify(orderBefore));
  const allLsKeys = await page.evaluate(() => Object.keys(localStorage));
  console.log('LS_KEYS', JSON.stringify(allLsKeys));

  const draggableBlocks = await page.$$('[draggable="true"]');
  console.log('DRAGGABLE_COUNT', draggableBlocks.length);
  if (draggableBlocks.length >= 2) {
    const first = draggableBlocks[0];
    const second = draggableBlocks[1];
    const firstBox = await first.boundingBox();
    const secondBox = await second.boundingBox();
    // Manual DnD sequence: HTML5 drag events don't fire reliably via mouse-only simulation,
    // so dispatch the drag events directly. Each dispatch is a SEPARATE evaluate() call with a
    // real wait between them so React actually commits setDraggingId(...) before drop reads it
    // (a real user drag takes real time; firing all 4 events in one synchronous tick starves
    // React's state update and makes the drop handler see a stale null draggingId).
    await page.evaluate(() => { window.__dt = new DataTransfer(); const from = document.querySelectorAll('[draggable="true"]')[0]; from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: window.__dt })); });
    await page.waitForTimeout(150);
    await page.evaluate(() => { const to = document.querySelectorAll('[draggable="true"]')[1]; to.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: window.__dt, cancelable: true })); });
    await page.waitForTimeout(150);
    await page.evaluate(() => { const to = document.querySelectorAll('[draggable="true"]')[1]; to.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: window.__dt, cancelable: true })); });
    await page.waitForTimeout(150);
    await page.evaluate(() => { const from = document.querySelectorAll('[draggable="true"]')[0]; from.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: window.__dt })); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/r18-04b-after-drag-reorder.png`, fullPage: false });
    const orderAfter = await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        try {
          const parsed = JSON.parse(localStorage.getItem(k));
          if (parsed && parsed.dashboardCardOrder) return { key: k, order: parsed.dashboardCardOrder };
        } catch {}
      }
      return null;
    });
    console.log('ORDER_AFTER', JSON.stringify(orderAfter));
    // reload and confirm it stuck
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await unlockPin(page);
    await page.waitForTimeout(600);
    const dashTabBtn2 = page.locator('button[data-tab="dashboard"]');
    if (await dashTabBtn2.count() > 0) { await dashTabBtn2.click(); await page.waitForTimeout(500); }
    const orderAfterReload = await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        try {
          const parsed = JSON.parse(localStorage.getItem(k));
          if (parsed && parsed.dashboardCardOrder) return { key: k, order: parsed.dashboardCardOrder };
        } catch {}
      }
      return null;
    });
    console.log('ORDER_AFTER_RELOAD', JSON.stringify(orderAfterReload));
    await page.screenshot({ path: `${OUT}/r18-04c-after-reload-order-check.png`, fullPage: false });
  }

  // --- Value pulse test: change gross income input to trigger CountUp pulse ---
  const incomeInput = await page.$('input[type="number"]');
  if (incomeInput) {
    await incomeInput.fill('95000');
    await incomeInput.press('Tab');
    await page.waitForTimeout(150); // catch mid-pulse
    await page.screenshot({ path: `${OUT}/r18-05-value-pulse-midflight.png`, fullPage: false });
    const pulseInfo = await page.evaluate(() => {
      const el = document.querySelector('.value-pulse');
      return el ? { className: el.className, text: el.textContent } : null;
    });
    console.log('PULSE_INFO', JSON.stringify(pulseInfo));
    await page.waitForTimeout(1000);
  }

  // --- Segmented control sliding thumb check — scope to the track that actually contains NZ/AU ---
  const findNzAuThumb = () => {
    const tracks = Array.from(document.querySelectorAll('.segmented-track'));
    const track = tracks.find((t) => /\bNZ\b/.test(t.textContent) && /\bAU\b/.test(t.textContent));
    return track ? track.querySelector('.segmented-thumb') : null;
  };
  const segBefore = await page.evaluate(() => {
    const track = Array.from(document.querySelectorAll('.segmented-track')).find((t) => t.textContent.includes('NZ') && t.textContent.includes('AU'));
    const thumb = track ? track.querySelector('.segmented-thumb') : null;
    return thumb ? { style: thumb.getAttribute('style'), rect: thumb.getBoundingClientRect() } : null;
  });
  const auBtn = page.locator('.segmented-track button:has-text("AU")').first();
  if (await auBtn.count() > 0) {
    await auBtn.click();
    await page.waitForTimeout(80); // mid-transition
    await page.screenshot({ path: `${OUT}/r18-06-segmented-mid-transition.png`, fullPage: false });
    await page.waitForTimeout(400);
    const segAfter = await page.evaluate(() => {
      const track = Array.from(document.querySelectorAll('.segmented-track')).find((t) => t.textContent.includes('NZ') && t.textContent.includes('AU'));
      const thumb = track ? track.querySelector('.segmented-thumb') : null;
      return thumb ? { style: thumb.getAttribute('style'), rect: thumb.getBoundingClientRect() } : null;
    });
    console.log('SEG_BEFORE', JSON.stringify(segBefore));
    console.log('SEG_AFTER', JSON.stringify(segAfter));
    // switch back
    const nzBtn = page.locator('.segmented-track button:has-text("NZ")').first();
    if (await nzBtn.count() > 0) await nzBtn.click();
    await page.waitForTimeout(400);
  }

  // --- Navigate to Upcoming Payments tab for Water icon check ---
  const upcomingTab = await page.$('text=Upcoming') || await page.$('text=Payments');
  const tabs = await page.$$('nav button, header button, [class*="nav-tab"]');
  console.log('TAB_COUNT', tabs.length);
  for (const t of tabs) {
    const txt = (await t.textContent())?.trim();
    if (txt && /upcoming/i.test(txt)) {
      await t.click();
      break;
    }
  }
  await page.waitForTimeout(600); // let 3D transition settle
  await page.screenshot({ path: `${OUT}/r18-07-upcoming-payments-3d-settled.png`, fullPage: false });

  // Water icon check — find bill row with "Water" or "Water Supply" text and screenshot around it
  const waterRow = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('*')).filter((el) => el.children.length === 0 && /water/i.test(el.textContent || ''));
    return rows.length;
  });
  console.log('WATER_TEXT_MATCHES', waterRow);

  const waterLocator = page.locator('text=/water/i').first();
  if (await waterLocator.count() > 0) {
    await waterLocator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const box = await waterLocator.boundingBox();
    if (box) {
      await page.screenshot({
        path: `${OUT}/r18-08-water-icon-zoom.png`,
        clip: { x: Math.max(0, box.x - 80), y: Math.max(0, box.y - 30), width: 400, height: 80 },
      });
    }
  }
  await page.screenshot({ path: `${OUT}/r18-09-upcoming-full.png`, fullPage: true });

  // Check icon-water-droplet actually present & visible (opacity/display) in DOM
  const waterIconInfo = await page.evaluate(() => {
    const el = document.querySelector('.icon-water-droplet');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { opacity: cs.opacity, display: cs.display, visibility: cs.visibility, className: el.getAttribute('class') };
  });
  console.log('WATER_ICON_INFO', JSON.stringify(waterIconInfo));

  // Disclosure test — find "Show all" button and click to expand
  const disclosureBtn = page.locator('text=/show all|show per-bill/i').first();
  if (await disclosureBtn.count() > 0) {
    await page.screenshot({ path: `${OUT}/r18-10-disclosure-collapsed.png`, fullPage: false });
    await disclosureBtn.click();
    await page.waitForTimeout(450); // let max-height transition finish
    await page.screenshot({ path: `${OUT}/r18-11-disclosure-expanded.png`, fullPage: false });
    const disclosureInfo = await page.evaluate(() => {
      const el = document.querySelector('.disclosure-body');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { maxHeight: cs.maxHeight, scrollHeight: el.scrollHeight };
    });
    console.log('DISCLOSURE_INFO', JSON.stringify(disclosureInfo));
  }

  // --- Household Split tab disclosure ---
  const hhTabs = await page.$$('nav button, header button, [class*="nav-tab"]');
  for (const t of hhTabs) {
    const txt = (await t.textContent())?.trim();
    if (txt && /household/i.test(txt)) { await t.click(); break; }
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/r18-12-household-split.png`, fullPage: true });

  // --- Button press feedback check: query a button and check :active CSS rule exists ---
  const buttonActiveRule = await page.evaluate(() => {
    let found = null;
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText && rule.selectorText.includes(':active') && rule.selectorText.includes('button')) {
            found = rule.cssText;
            break;
          }
        }
      } catch (e) {}
      if (found) break;
    }
    return found;
  });
  console.log('BUTTON_ACTIVE_RULE', buttonActiveRule);

  // --- 3D transition CSS check ---
  const page3dRule = await page.evaluate(() => {
    let found = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText && /page-enter/.test(rule.selectorText)) {
            found.push(rule.cssText.slice(0, 200));
          }
        }
      } catch (e) {}
    }
    return found;
  });
  console.log('PAGE_3D_RULES', JSON.stringify(page3dRule));

  // Console errors dump
  console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));

  await browser.close();
})();
