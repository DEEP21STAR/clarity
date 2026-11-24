import { test, expect } from '@playwright/test'
import { TABS } from './support/app'

// Internal function names must never reach a screen (a health-score line once said "see calcFinancialHealthScore() for the formula").
test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } })
for (const tab of ['home', ...TABS]) {
  test(`no code-style text on ${tab}`, async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } })
    await page.goto(`./?tab=${tab}`)
    await page.waitForTimeout(1800)
    const text = await page.locator('body').innerText()
    const hits = text.match(/\b[a-z]+[A-Z][A-Za-z]*\(\)|\b[a-z_]+\.[a-z]+\.[a-z]+\(|\bundefined\b|\bNaN\b|\[object Object\]/g) ?? []
    expect(hits, `code-style or broken text on ${tab}`).toEqual([])
  })
}
