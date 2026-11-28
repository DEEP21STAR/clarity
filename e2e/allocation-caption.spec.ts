import { test, expect } from '@playwright/test'
import { VIEWPORTS } from './support/app'

// Overspent week (default data: bills due before payday exceed the money in accounts): the tiles must not say "of -$X spent".
test.use({ reducedMotion: 'reduce', viewport: VIEWPORTS.desktop })
test('allocation tiles say nothing is set aside instead of "of -$X spent"', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } })
  await page.goto('./?tab=upcoming')
  // the default funds change with the calendar, so check the wording, not a fixed dollar figure
  await expect(page.getByText(/Short by \$[\d,.]+ · nothing set aside this period/).first()).toBeVisible()
  expect(await page.getByText(/Short by \$[\d,.]+ · nothing set aside this period/).count(), 'one caption per allocation tile').toBeGreaterThanOrEqual(2)
  await expect(page.getByText(/of -\$[\d,.]+ spent/)).toHaveCount(0)
  await page.screenshot({ path: 'test-results/allocation.png', clip: { x: 0, y: 330, width: 1440, height: 570 } })
})

// Phone width: the big number must not be clipped and the caption must not be squeezed into a thin column.
test('on a phone the allocation tile number is whole and the caption has room', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.phone)
  await page.addInitScript(() => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } })
  await page.goto('./?tab=upcoming')
  const caption = page.getByText(/Short by \$[\d,.]+ · nothing set aside this period/).first()
  await caption.scrollIntoViewIfNeeded()
  const box = await caption.boundingBox()
  expect(box!.width, 'caption column is not squeezed').toBeGreaterThan(130)
  expect(box!.height, 'caption wraps to at most three lines').toBeLessThan(60)
  // the big number sits right above the caption and is not wider than its own box (not clipped)
  const clipped = await caption.evaluate((el) => { const num = el.previousElementSibling as HTMLElement; return num.scrollWidth > num.clientWidth + 1 })
  expect(clipped, 'big number is clipped').toBe(false)
  await page.screenshot({ path: 'test-results/alloc-phone-after.png' })
})
