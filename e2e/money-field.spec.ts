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
