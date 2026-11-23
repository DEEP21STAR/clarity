import { test, expect } from '@playwright/test'
import { VIEWPORTS } from './support/app'

// Overspent week (default data: bills due before payday exceed the money in accounts): the tiles must not say "of -$X spent".
test.use({ reducedMotion: 'reduce', viewport: VIEWPORTS.desktop })
test('allocation tiles say nothing is set aside instead of "of -$X spent"', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } })
  await page.goto('./?tab=upcoming')
  // -$674.94 live funds: Food 40% = -269.976 -> $269.98, Fuel 25% = -168.735 -> $168.73 (same rounding as the big number)
  await expect(page.getByText('Short by $269.98 · nothing set aside this period')).toBeVisible()
  await expect(page.getByText('Short by $168.73 · nothing set aside this period')).toBeVisible()
  await expect(page.getByText(/of -\$[\d,.]+ spent/)).toHaveCount(0)
  await page.screenshot({ path: 'test-results/allocation.png', clip: { x: 0, y: 330, width: 1440, height: 570 } })
})
