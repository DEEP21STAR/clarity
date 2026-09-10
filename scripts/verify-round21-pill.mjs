import { chromium } from 'playwright';

const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad';
const URL = 'http://localhost:4173';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const d of ['6', '3', '0', '4']) await page.click(`button:has-text("${d}")`, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);

  // Find the household Deep/Mimi/Combined segmented control (already defaults to "Combined")
  const track = page.locator('.segmented-track', { hasText: 'Combined' }).first();
  await track.waitFor();
  const box = await track.boundingBox();
  console.log('TRACK_BOX', JSON.stringify(box));

  // Tight crop right around the pill only
  await page.screenshot({
    path: `${OUT}/r21-pill-combined-tight-crop.png`,
    clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 },
  });

  // Real DOM measurement check: does the thumb's box now fully contain the active button's box?
  const measurement = await page.evaluate(() => {
    const tracks = Array.from(document.querySelectorAll('.segmented-track'));
    const track = tracks.find((t) => t.textContent.includes('Combined'));
    const thumb = track.querySelector('.segmented-thumb');
    const buttons = Array.from(track.querySelectorAll('button'));
    const activeBtn = buttons.find((b) => b.textContent.trim() === 'Combined');
    const thumbRect = thumb.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    // Also measure the actual glyph bounds via a Range around the text node
    const range = document.createRange();
    range.selectNodeContents(activeBtn);
    const textRect = range.getBoundingClientRect();
    return {
      thumbRect: { left: thumbRect.left, right: thumbRect.right, width: thumbRect.width },
      btnRect: { left: btnRect.left, right: btnRect.right, width: btnRect.width },
      textRect: { left: textRect.left, right: textRect.right, width: textRect.width },
      textFullyInsideThumb: textRect.left >= thumbRect.left && textRect.right <= thumbRect.right,
    };
  });
  console.log('MEASUREMENT', JSON.stringify(measurement, null, 2));

  // Also check the mode/country segmented controls (Personal/Business, NZ/AU) on Dashboard for regressions
  for (const t of await page.$$('nav button, header button, [class*="nav-tab"]')) {
    const txt = (await t.textContent())?.trim();
    if (txt === 'Dashboard') { await t.click(); break; }
  }
  await page.waitForTimeout(600);
  const dashTrack = page.locator('.segmented-track', { hasText: 'Business' }).first();
  if (await dashTrack.count() > 0) {
    const dbox = await dashTrack.boundingBox();
    await page.screenshot({
      path: `${OUT}/r21-pill-personal-business-crop.png`,
      clip: { x: dbox.x - 10, y: dbox.y - 10, width: dbox.width + 20, height: dbox.height + 20 },
    });
  }

  await browser.close();
})();
