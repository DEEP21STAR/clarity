import { test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { TABS } from './support/app'
// Audit only: screenshots every tab in the light theme and lists colour-contrast failures.
test.use({ reducedMotion: 'reduce' })
for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
  test(`light audit ${label}`, async ({ page }) => {
    test.setTimeout(240_000)
    await page.setViewportSize(vp)
    await page.addInitScript(() => { try { sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)); localStorage.setItem('clarity-whatsnew-seen', '2026-11-25'); localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify({ grossAnnualIncome: 90000, country: 'NZ', colorMode: 'light' })) } catch { /* ignore */ } })
    for (const tab of [...(label === 'phone' ? ['home'] : []), ...TABS]) {
      await page.goto(`./?tab=${tab}`)
      await page.waitForTimeout(1800)
      await page.screenshot({ path: `test-results/light/${label}-${tab}.png`, fullPage: false })
      const ax = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
      const bad = ax.violations.flatMap((v) => v.nodes.map((n) => `${(n.any[0]?.data as { fgColor?: string; bgColor?: string; contrastRatio?: number } | undefined)?.contrastRatio} ${String(n.html).slice(0, 70)}`))
      console.log(`LIGHT ${label} ${tab}: theme=${await page.evaluate(() => document.documentElement.dataset.theme)} contrast issues ${bad.length} ${JSON.stringify(bad.slice(0, 4))}`)
    }
  })
}
