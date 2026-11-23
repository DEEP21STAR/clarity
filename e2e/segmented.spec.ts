import { test, expect } from '@playwright/test'

// The period selector on Budgets must fit inside the screen (or scroll inside its own box) on small phones; it used to be cut off at the right edge.
test.use({ reducedMotion: 'reduce' })
for (const width of [320, 360, 390]) {
  test(`period selector stays inside the screen at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.addInitScript(() => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } })
    await page.goto('./?tab=budgets')
    await page.getByRole('button', { name: /^monthly$/i }).waitFor()
    const track = page.locator('.segmented-track').filter({ has: page.getByRole('button', { name: /^annual$/i }) })
    const box = await track.boundingBox()
    expect(box!.x + box!.width, 'selector box must not run past the screen').toBeLessThanOrEqual(width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'page must not scroll sideways').toBe(true)
    // every option is reachable: the last one can be scrolled to and clicked
    await page.getByRole('button', { name: /^annual$/i }).click()
    const annual = await page.getByRole('button', { name: /^annual$/i }).boundingBox()
    expect(annual!.x + annual!.width).toBeLessThanOrEqual(width + 1)
    // with room to spare inside the box at 390px (a different machine's fonts can be wider than ours)
    if (width >= 390) expect(await track.evaluate((t) => t.scrollWidth - t.clientWidth), 'no hidden overflow at 390px').toBeLessThanOrEqual(0)
    await track.screenshot({ path: `test-results/segmented-${width}.png` })
  })
}
