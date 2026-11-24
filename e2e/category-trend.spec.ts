import { test, expect } from '@playwright/test'

// Per-category six-month trend line on the Budgets tab. Seed: Food spent heavily last month, less so far this month; Fuel only this month.
const now = new Date()
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const THIS = ym(now), PREV = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1)), PREV2 = ym(new Date(now.getFullYear(), now.getMonth() - 2, 1))
let n = 0
const tx = (m: string, day: string, amount: number, category: string) => ({ id: 'tr' + n++, date: `${m}-${day}`, amount, description: category + ' purchase', category })
const SEED = {
  transactions: [
    tx(PREV2, '04', -180, 'Food'), tx(PREV, '01', -150, 'Food'), tx(PREV, '02', -120, 'Food'), tx(THIS, '01', -60, 'Food'),
    tx(THIS, '01', -40, 'Fuel'),
  ],
  categoryBudgets: { Food: { monthly: 400 }, Fuel: { monthly: 100 } },
}
const open = async (page: import('@playwright/test').Page, w: number) => {
  await page.setViewportSize({ width: w, height: 844 })
  await page.addInitScript((s) => { try { localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)) } catch { /* ignore */ } }, SEED)
  await page.goto('./?tab=budgets')
}

test('a category with two or more months of spend shows a trend line and a plain sentence', async ({ page }) => {
  await open(page, 390)
  const trends = page.getByTestId('category-trend')
  await expect(trends.first()).toBeVisible()
  expect(await trends.count(), 'only Food has two months of spend; Fuel has one').toBe(1)
  const label = await trends.first().locator('svg').getAttribute('aria-label')
  expect(label).toMatch(/^Food spending, last 6 months: /)
  // the sentence only appears when last month had spend to compare to; a day-of-month earlier than the 2nd can legitimately say nothing
  const text = await trends.first().innerText()
  if (now.getDate() >= 2) expect(text).toMatch(/Up|Down|About the same/)
})

test('the line draws itself in, and is fully drawn with reduced motion', async ({ page }) => {
  await open(page, 390)
  const line = page.locator('.trend-spark-line').first()
  await expect(line).toBeAttached()
  await page.waitForTimeout(1700)
  expect(await line.evaluate((e) => getComputedStyle(e).strokeDashoffset)).toMatch(/^0(px)?$/)
})

test('with reduced motion the line is drawn immediately', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, serviceWorkers: 'block', baseURL: 'http://127.0.0.1:4173/clarity/' })
  const page = await ctx.newPage()
  await page.addInitScript((s) => { try { localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)) } catch { /* ignore */ } }, SEED)
  await page.goto('./?tab=budgets')
  const line = page.locator('.trend-spark-line').first()
  await expect(line).toBeAttached()
  expect(await line.evaluate((e) => getComputedStyle(e).strokeDashoffset)).toMatch(/^0(px)?$/)
  await ctx.close()
})

test('the trend row does not run past the right edge at 320px', async ({ page }) => {
  await open(page, 320)
  await page.waitForTimeout(1500)
  const r = await page.getByTestId('category-trend').first().evaluate((e) => [...e.querySelectorAll('*')].map((c) => c.getBoundingClientRect().right).reduce((a, b) => Math.max(a, b), 0))
  expect(r).toBeLessThanOrEqual(321)
  await page.screenshot({ path: 'test-results/category-trend-320.png' })
})

test('a budget row says where the month is heading at the current pace', async ({ page }) => {
  await open(page, 390)
  const day = now.getDate(), dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const rows = page.getByTestId('month-end-pace')
  if (day < 7 || day >= dim) { await expect(rows).toHaveCount(0); return } // too early or the month is over: nothing is said
  const food = Math.round(((60 / day) * dim) * 100) / 100
  await expect(rows.first()).toBeVisible()
  const all = (await rows.allInnerTexts()).join(' | ')
  expect(all).toContain('On pace for $' + food.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' by month end, within your target.')
})
