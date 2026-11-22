import { test, expect } from '@playwright/test'
import { openApp, TABS, VIEWPORTS } from './support/app'

// Every tab, both screen sizes: loads, no uncaught errors, no console errors, no sideways scroll, something readable on screen.
for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`smoke @ ${vpName}`, () => {
    test.use({ viewport: vp })
    for (const tab of TABS) {
      test(`${tab} renders cleanly`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
        page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
        await openApp(page, tab)
        await page.waitForTimeout(800)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow, 'horizontal overflow (px)').toBeLessThanOrEqual(1)
        expect((await page.locator('h1, h2').count()), 'has a heading').toBeGreaterThan(0)
        expect(errors, errors.join('\n')).toEqual([])
      })
    }
  })
}
