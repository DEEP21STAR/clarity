import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { VIEWPORTS } from './support/app'

// "Last month in review": built from the previous complete month. Dates are relative to the real clock (no frozen clock: that breaks click stability).
const now = new Date()
const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
const ym = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
const label = prev.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })
const tx = (id: string, day: string, amount: number, category: string, description = category) => ({ id, date: `${ym}-${day}`, amount, description, category, mode: 'personal' })
// Spent 100 + 50 + 300 + 50 = 500; income 1000; left over 500; spending days: 02, 15, 20.
const SEED = { transactions: [tx('a', '02', -100, 'Groceries', 'Pak n Save'), tx('b', '02', -50, 'Fuel'), tx('c', '15', -300, 'Rent'), tx('d', '20', -50, 'Groceries'), tx('e', '25', 1000, 'Income', 'Pay')] }

for (const [name, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`month recap @ ${name}`, () => {
    test.use({ viewport: vp, reducedMotion: 'reduce' })
    test('shows the checkable figures and passes axe', async ({ page }) => {
      await page.addInitScript((seed) => { try { if (!sessionStorage.getItem('e2e-seeded')) { localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(seed)); sessionStorage.setItem('e2e-seeded', '1') } sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } }, SEED)
      await page.goto('./?tab=budgets')
      const card = page.getByRole('region', { name: `${label} in review` })
      await expect(card).toBeVisible()
      await expect(card.getByText('$500.00').first()).toBeVisible() // spent, and left over
      await expect(card.getByText('$1,000.00')).toBeVisible() // money in
      await expect(card.getByText('Rent', { exact: true })).toBeVisible()
      await expect(card.getByText('$300.00 · 60%')).toBeVisible()
      await expect(card.getByText(/Biggest single expense: Rent/)).toBeVisible()
      const days = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate()
      await expect(card.getByText(`${days - 3} of ${days}`)).toBeVisible()
      await card.scrollIntoViewIfNeeded()
      await page.waitForTimeout(600)
      await card.screenshot({ path: `test-results/month-recap-${name}.png` })
      const r = await new AxeBuilder({ page }).include('section[aria-label$="in review"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      expect(r.violations.map((v) => v.id)).toEqual([])
    })
  })
}

test('no card when there is no previous month of data', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } })
  await page.goto('./?tab=budgets')
  await page.getByRole('heading', { name: 'Budgets' }).waitFor()
  await expect(page.locator('section[aria-label$="in review"]')).toHaveCount(0)
})
