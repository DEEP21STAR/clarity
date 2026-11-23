import { test, expect } from '@playwright/test'
import { VIEWPORTS } from './support/app'

// Regression: outside the morning (05-11) and evening (17-23) tint windows the tint class is empty, and adding an empty class
// to <html> threw and blanked the whole app. Check every tint window renders. (Clock is fixed only for load: this spec never clicks.)
test.use({ reducedMotion: 'reduce', viewport: VIEWPORTS.desktop })
for (const [name, hour] of [['midday', 13], ['night', 2], ['morning', 8], ['evening', 19]] as const) {
  test(`app renders at ${name} (${hour}:00)`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.clock.setFixedTime(new Date(2026, 10, 24, hour, 0, 0))
    await page.addInitScript(() => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } })
    await page.goto('./?tab=budgets')
    await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible()
    expect(errors, 'no uncaught page errors').toEqual([])
    const classes = await page.evaluate(() => document.documentElement.className)
    expect(classes).toContain('ambient-drift')
  })
}
