import { test, expect } from '@playwright/test'
import { openApp, TABS, VIEWPORTS } from './support/app'

// Visual regression net: a screenshot of every tab at desktop and phone size, compared with a committed baseline.
// Made stable by: a frozen clock (dates, "due in N days" and greetings never drift), reduced motion (the app's own
// reduced-motion path is static), animations disabled, and the moving background canvases masked.
// Baselines are per platform (Playwright puts the platform in the file name): Linux headless Chromium here; a Windows run
// (PREDATOR) creates its own set. Update after an intended design change with: npx playwright test e2e/visual.spec.ts --update-snapshots
test.use({ reducedMotion: 'reduce' })

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`visual @ ${vpName}`, () => {
    test.use({ viewport: vp })
    const tabs = vpName === 'phone' ? (['home', ...TABS] as const) : TABS
    for (const tab of tabs) {
      test(`${tab}`, async ({ page }) => {
        await page.clock.setFixedTime(new Date('2026-11-22T10:00:00+13:00'))
        // A recent launch means the short 0.7 s splash, so the page behind it is already settled when we look.
        await page.addInitScript(() => { try { localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } })
        await openApp(page, tab)
        // The app grades its colours by time of day (a slight hue/saturation filter); switch that off so screenshots only ever change when the design does.
        await page.addStyleTag({ content: '.tint-morning, .tint-evening { filter: none !important; }' })
        await page.waitForTimeout(3500)
        // Some pages (Debts) finish their entrance about 6 s after load, and the header's "Saved" pill fades on its own
        // timer, so allow longer to settle and mask that pill.
        await expect(page).toHaveScreenshot(`${vpName}-${tab}.png`, {
          animations: 'disabled',
          maxDiffPixelRatio: 0.002,
          // Playwright's default per-pixel colour tolerance (0.2) hid a whole-app grey-text change; 0.05 catches subtle colour shifts.
          threshold: 0.05,
          timeout: 40_000,
          mask: [page.locator('canvas'), page.getByText('Saved', { exact: true })],
        })
      })
    }
  })
}
