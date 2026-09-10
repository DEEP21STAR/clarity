import { chromium } from 'playwright';

const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';
const URL = 'http://localhost:4173';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) {
    await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  }
  await page.waitForTimeout(800);

  // Upcoming Payments is the default tab already
  const showAllBtn = page.locator('text=/show all \\d+ bills/i').first();
  console.log('SHOW_ALL_BTN_COUNT', await showAllBtn.count());
  console.log('SHOW_ALL_BTN_TEXT', await showAllBtn.textContent().catch(() => 'ERR'));
  await showAllBtn.scrollIntoViewIfNeeded();
  await showAllBtn.click();
  await page.waitForTimeout(500);

  const debugLabels = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('span')).filter((s) => /recurring/i.test(s.textContent || ''));
    return spans.map((s) => ({ text: s.textContent, tag: s.tagName, hasTable: !!s.closest('div')?.querySelector('table') }));
  });
  console.log('DEBUG_LABELS', JSON.stringify(debugLabels));
  const debugTables = await page.evaluate(() => document.querySelectorAll('table').length);
  console.log('DEBUG_TABLE_COUNT', debugTables);

  // Scope strictly to the Recurring Bills card (not the Household Split table, which also
  // has a still-mounted-but-collapsed "Water" row with no icon by design) to avoid grabbing
  // the wrong "Water" match — Disclosure content stays mounted (max-height:0), so a bare
  // `tr:has-text("Water")` anywhere in the DOM can match a hidden, unrelated table.
  const waterBox = await page.evaluate(() => {
    const labelEl = Array.from(document.querySelectorAll('span, h2, h3')).find((el) => el.textContent?.trim() === 'Recurring Bills');
    let scope = document;
    if (labelEl) {
      let node = labelEl;
      for (let i = 0; i < 8 && node; i++) {
        if (node.querySelector && node.querySelector('table')) { scope = node; break; }
        node = node.parentElement;
      }
    }
    // Bill names are rendered inside an editable <input>, so its VALUE (not textContent)
    // is where "Water" actually lives — this is why the earlier textContent-based row
    // lookup silently found nothing for every bill name.
    const nameInput = Array.from(scope.querySelectorAll('input')).find((inp) => inp.value === 'Water');
    const row = nameInput ? nameInput.closest('tr') : null;
    if (!row) return null;
    row.scrollIntoView({ block: 'center' });
    const r = row.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  await page.waitForTimeout(300);
  const debugRows = await page.evaluate(() => window.__debugRows);
  console.log('DEBUG_ROWS', JSON.stringify(debugRows));
  await page.screenshot({ path: `${OUT}/r18-water-row-expanded-full.png`, fullPage: false });

  if (waterBox) {
    await page.screenshot({
      path: `${OUT}/r18-water-row-zoom.png`,
      clip: { x: Math.max(0, waterBox.x - 20), y: Math.max(0, waterBox.y - 10), width: Math.min(700, waterBox.width + 40), height: waterBox.height + 20 },
    });
  } else {
    console.log('WATER_BOX_NOT_FOUND');
  }

  const iconCheck = await page.evaluate(() => {
    const labelEl = Array.from(document.querySelectorAll('span, h2, h3')).find((el) => el.textContent?.trim() === 'Recurring Bills');
    let scope = document;
    if (labelEl) {
      let node = labelEl;
      for (let i = 0; i < 8 && node; i++) {
        if (node.querySelector && node.querySelector('table')) { scope = node; break; }
        node = node.parentElement;
      }
    }
    const nameInput = Array.from(scope.querySelectorAll('input')).find((inp) => inp.value === 'Water');
    const row = nameInput ? nameInput.closest('tr') : null;
    if (!row) return { found: false };
    const svg = row.querySelector('svg');
    const wrap = row.querySelector('.icon-water-wrap');
    const droplet = row.querySelector('.icon-water-droplet');
    return {
      found: true,
      rowText: row.textContent.trim().slice(0, 80),
      hasSvg: !!svg,
      hasWrap: !!wrap,
      hasDroplet: !!droplet,
      dropletOpacity: droplet ? getComputedStyle(droplet).opacity : null,
      dropletVisible: droplet ? getComputedStyle(droplet).visibility : null,
    };
  });
  console.log('WATER_ROW_ICON_CHECK', JSON.stringify(iconCheck, null, 2));

  await browser.close();
})();
