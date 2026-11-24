import { test, expect } from '@playwright/test'

// In a short window (a tiled browser window about 340px tall) the sticky header would pin about a third of the page for ever:
// under 480px of height it scrolls away like normal content; at normal heights it stays pinned.
test.use({ reducedMotion: 'reduce' })
const unlocked = () => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } }

for (const [w, h, expected] of [[701, 340, 'static'], [346, 421, 'static'], [1100, 479, 'static'], [1100, 481, 'sticky'], [1440, 900, 'sticky'], [390, 844, 'sticky']] as const) {
  test(`header is ${expected} at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await page.addInitScript(unlocked)
    await page.goto('./?tab=budgets')
    await page.getByRole('heading', { name: 'Budgets' }).waitFor()
    expect(await page.locator('header').first().evaluate((el) => getComputedStyle(el).position)).toBe(expected)
    if (expected === 'static') {
      await page.evaluate(() => window.scrollTo(0, 400))
      await page.waitForTimeout(300)
      const top = await page.locator('header').first().evaluate((el) => el.getBoundingClientRect().bottom)
      expect(top, 'the header has scrolled off the top').toBeLessThanOrEqual(0)
    }
  })
}
