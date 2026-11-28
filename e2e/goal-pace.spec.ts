import { test, expect, type Page } from '@playwright/test'
import { VIEWPORTS } from './support/app'

// Savings goals: weekly pace to the target date, milestone chip, overdue and done wording.
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d) }
const SEED = {
  savingsGoals: [
    { id: 'g1', name: 'Bike', targetAmount: 1000, contributedAmount: 600, fundedThisPeriod: 0, targetDate: inDays(28) },
    { id: 'g2', name: 'Old trip', targetAmount: 500, contributedAmount: 100, fundedThisPeriod: 0, targetDate: inDays(-5) },
    { id: 'g3', name: 'Laptop', targetAmount: 300, contributedAmount: 300, fundedThisPeriod: 0 },
  ],
}

async function open(page: Page) {
  await page.addInitScript((seed) => {
    try {
      if (!sessionStorage.getItem('e2e-seeded')) { localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(seed)); sessionStorage.setItem('e2e-seeded', '1') }
      sessionStorage.setItem('clarity-pin-unlocked', '1')
      localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000))
    } catch { /* ignore */ }
  }, SEED)
  await page.goto('./?tab=upcoming')
  await page.getByText('Bike').first().waitFor()
}

test.use({ reducedMotion: 'reduce' })

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`goal pace @ ${vpName}`, () => {
    test.use({ viewport: vp })
    test('weekly figure, milestone, overdue and done', async ({ page }) => {
      await open(page)
      const paces = page.getByTestId('goal-pace')
      await expect(paces.filter({ hasText: '$100.00 a week for 28 days' })).toHaveCount(1) // $400 over 4 weeks
      await expect(page.getByTestId('goal-milestone').filter({ hasText: '50% of the way' })).toHaveCount(1)
      await expect(paces.filter({ hasText: 'Target date has passed' })).toHaveCount(1)
      await expect(paces.filter({ hasText: 'Goal reached' })).toHaveCount(1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
      await page.getByText('Bike').first().scrollIntoViewIfNeeded()
      await page.screenshot({ path: `test-results/goal-pace-${vpName}.png` })
    })
  })
}
