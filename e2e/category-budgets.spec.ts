import { test, expect, type Page } from '@playwright/test'
import { VIEWPORTS } from './support/app'

// Category budgets: set a target (typed or suggested from history), see live progress, carry-forward, and persistence across a reload.
// Dates are built from the real current month (not a frozen clock: that stops Playwright's click "stable" check from ever completing),
// and amounts are chosen so the expected status holds on any day of the month.
const now = new Date()
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const THIS = ym(now)
const PREV = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1))
const tx = (id: string, date: string, amount: number, category: string) => ({ id, date, amount, description: category, category, mode: 'personal' })
const SEED = {
  transactions: [
    tx('a', `${THIS}-01`, -10, 'Food'), tx('b', `${THIS}-01`, -10, 'Food'), tx('c', `${THIS}-01`, -30, 'Fuel'),
    tx('d', `${PREV}-05`, -200, 'Food'), tx('e', `${PREV}-06`, -60, 'Fuel'),
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
  await page.goto('./?tab=budgets')
  await page.getByRole('heading', { name: 'Budgets' }).waitFor()
}

// Reduced motion: the page's slow ambient drift would otherwise keep every button "moving", and Playwright waits for a click target to hold still.
test.use({ reducedMotion: 'reduce' })

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`category budgets @ ${vpName}`, () => {
    test.use({ viewport: vp })

    test('the bell warns about an over-target category', async ({ page }) => {
      await open(page)
      const fuel = page.getByRole('listitem').filter({ has: page.getByLabel('Fuel monthly target') })
      await fuel.getByLabel('Fuel monthly target').fill('25') // $30 already spent this month -> over by $5
      await fuel.getByLabel('Fuel monthly target').press('Enter')
      await page.getByRole('button', { name: /alerts? — price changes/ }).click()
      await expect(page.getByText('Fuel is over its monthly target by $5.')).toBeVisible()
    })

    test('suggestions, typed targets, live status and carry-forward', async ({ page }) => {
      await open(page)
      const food = page.getByRole('listitem').filter({ hasText: 'Food' }).filter({ has: page.getByLabel('Food monthly target') })
      const fuel = page.getByRole('listitem').filter({ has: page.getByLabel('Fuel monthly target') })
      await expect(food).toContainText('No target')
      // a suggestion from last month's history (Food spent $200 last month)
      await food.getByRole('button', { name: /Set to \$200/ }).click()
      await expect(food).toContainText('On track')
      await expect(food.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10') // 20 of 200
      await expect(food).toContainText('$180')
      // what a 10% trim would free up: 10% of 200 = $20 a month, $240 a year
      await expect(food).toContainText('Trim 10% and you free up $20.00 a month, $240.00 a year.')
      await expect(fuel).not.toContainText('Trim 10%') // no target yet, so no trim line
      // a typed target that is already exceeded
      await fuel.getByLabel('Fuel monthly target').fill('25')
      await fuel.getByLabel('Fuel monthly target').press('Enter')
      await expect(fuel).toContainText('Over')
      await expect(fuel).toContainText('$5')
      // carry-forward is off until switched on; then last month's unspent amount is added
      await food.getByLabel('Food monthly target').fill('300')
      await food.getByLabel('Food monthly target').press('Enter')
      await expect(food).not.toContainText('carried over')
      await food.getByLabel('Carry unspent forward').check()
      await expect(food).toContainText(/includes \$100(\.00)? carried over/)
      // the summary line reflects the budgeted categories
      await expect(page.getByText(/You have spent/)).toContainText('of')
    })

    test('targets survive a reload', async ({ page }) => {
      await open(page)
      const fuel = page.getByRole('listitem').filter({ has: page.getByLabel('Fuel monthly target') })
      await fuel.getByLabel('Fuel monthly target').fill('300')
      await fuel.getByLabel('Fuel monthly target').press('Enter')
      await expect(fuel).toContainText('On track')
      await page.reload()
      await page.getByRole('heading', { name: 'Budgets' }).waitFor()
      await expect(page.getByLabel('Fuel monthly target')).toHaveValue('300')
    })

    test('clearing the target removes the budget', async ({ page }) => {
      await open(page)
      const fuel = page.getByRole('listitem').filter({ has: page.getByLabel('Fuel monthly target') })
      await fuel.getByLabel('Fuel monthly target').fill('300')
      await fuel.getByLabel('Fuel monthly target').press('Enter')
      await expect(fuel).toContainText('On track')
      await fuel.getByLabel('Fuel monthly target').fill('')
      await fuel.getByLabel('Fuel monthly target').press('Enter')
      await expect(fuel).toContainText('No target')
    })
  })
}
