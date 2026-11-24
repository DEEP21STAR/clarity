import { test, expect, type Page } from '@playwright/test'

// Tip of the day: two lines on a phone with a "Show more" toggle, full text on wide screens, dismiss still works.
const SET_UP = { grossAnnualIncome: 90000, country: 'NZ' }
async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 })
  await page.addInitScript((s) => { try { sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)); localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)) } catch { /* ignore */ } }, SET_UP)
  await page.goto('./?tab=dashboard')
}
const lines = (page: Page) => page.getByTestId('tip-text').evaluate((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)))

test('on a phone the tip is at most two lines until Show more is pressed', async ({ page }) => {
  await open(page, 320)
  const tip = page.getByTestId('tip-of-day')
  await expect(tip).toBeVisible()
  expect(await lines(page)).toBeLessThanOrEqual(2)
  const more = tip.getByRole('button', { name: 'Show more' })
  await expect(more).toBeVisible() // at 320px every tip in the list is longer than two lines
  await more.click()
  expect(await lines(page)).toBeGreaterThan(2)
  await expect(tip.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true')
  await tip.getByRole('button', { name: 'Show less' }).click()
  expect(await lines(page)).toBeLessThanOrEqual(2)
  await page.screenshot({ path: 'test-results/tip-clamp-320.png' })
})

test('on a wide screen the whole tip shows and there is no toggle', async ({ page }) => {
  await open(page, 1440)
  const tip = page.getByTestId('tip-of-day')
  await expect(tip).toBeVisible()
  await expect(tip.getByRole('button', { name: /Show (more|less)/ })).toBeHidden()
  expect(await page.getByTestId('tip-text').evaluate((e) => e.scrollHeight <= e.clientHeight + 1), 'nothing is cut off').toBe(true)
})

test('the dismiss button is a full-size tap target and hides the tip', async ({ page }) => {
  await open(page, 390)
  const btn = page.getByRole('button', { name: "Dismiss today's tip" })
  const box = await btn.boundingBox()
  expect(box!.width).toBeGreaterThanOrEqual(40)
  expect(box!.height).toBeGreaterThanOrEqual(40)
  await btn.click()
  await expect(page.getByTestId('tip-of-day')).toHaveCount(0)
})
