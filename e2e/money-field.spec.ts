import { test, expect } from '@playwright/test'
import { VIEWPORTS } from './support/app'

// The Gross Annual Income box groups thousands as you type and keeps a half-typed decimal.
test.use({ reducedMotion: 'reduce', viewport: VIEWPORTS.desktop })

test('income box shows 65,000 and keeps a typed decimal point', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify({ grossAnnualIncome: 65000 }))
      sessionStorage.setItem('clarity-pin-unlocked', '1')
      localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000))
    } catch { /* ignore */ }
  })
  await page.goto('./?tab=dashboard')
  const box = page.getByLabel('Gross annual income')
  await expect(box).toHaveValue('65,000')
  await box.fill('')
  await box.pressSequentially('1200.')
  await expect(box).toHaveValue('1,200.')
  await box.pressSequentially('5')
  await expect(box).toHaveValue('1,200.5')
  await box.blur()
  await expect(box).toHaveValue('1,200.5')
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('clarity-dashboard-state-v5') || '{}').grossAnnualIncome)
  expect(stored).toBe(1200.5)
})

test('GST amount box groups thousands and the calculator still works', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } })
  await page.goto('./?tab=tools')
  const box = page.getByLabel('Amount for GST')
  await box.fill('')
  await box.pressSequentially('11500')
  await expect(box).toHaveValue('11,500')
  await expect(page.getByText('$1,725.00').first()).toBeVisible()
  await expect(page.getByText('$13,225.00').first()).toBeVisible()
})

test('dashboard headline groups thousands and highlights the whole figure', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } })
  await page.goto('./?tab=dashboard')
  const headline = page.locator('p.font-semibold').filter({ hasText: /a month to work with|more than your net income/ })
  await expect(headline).toContainText('$1,534.21')
  await expect(headline.locator('.gradient-heading').first()).toHaveText('$1,534.21')
  await headline.screenshot({ path: 'test-results/headline.png' })
})

test('Debts extra monthly budget groups thousands', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } })
  await page.goto('./?tab=debts')
  const box = page.getByLabel('Extra monthly budget')
  await expect(box).toHaveValue('100')
  await box.fill('')
  await box.pressSequentially('2500')
  await expect(box).toHaveValue('2,500')
})

test('editing in the middle of a number keeps the caret where you are', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } })
  await page.goto('./?tab=debts')
  const box = page.getByLabel('Extra monthly budget')
  await box.fill('')
  await box.pressSequentially('123')
  await box.press('Home')
  await box.press('ArrowRight') // caret after the "1"
  await box.pressSequentially('9') // 1,923: a comma now sits before the caret
  await expect(box).toHaveValue('1,923')
  await box.pressSequentially('8') // the caret must be right after the 9 (digits 1 9 8 23 -> 19,823)
  await expect(box).toHaveValue('19,823')
})
