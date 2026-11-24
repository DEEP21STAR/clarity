import { test, expect, type Page } from '@playwright/test'

// "Since you were last here" strip on Dashboard (wide) and Home (phone).
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d }
const SEED = {
  transactions: [
    { id: 'sv1', date: iso(daysAgo(1)), description: 'Groceries', amount: -80, category: 'Food', mode: 'combined' },
    { id: 'sv2', date: iso(daysAgo(2)), description: 'Pay', amount: 900, category: 'Income', mode: 'combined' },
  ],
}
async function setup(page: Page, lastVisit: string | null, width = 1440) {
  await page.setViewportSize({ width, height: 900 })
  await page.addInitScript(([s, last]) => {
    try {
      sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000))
      if (!sessionStorage.getItem('seeded')) { localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)); if (last) localStorage.setItem('clarity-last-visit', last as string); sessionStorage.setItem('seeded', '1') }
    } catch { /* ignore */ }
  }, [SEED, lastVisit] as const)
}

test('after a few days away the Dashboard says what changed, then it can be hidden for the session', async ({ page }) => {
  await setup(page, iso(daysAgo(5)))
  await page.goto('./?tab=dashboard')
  const strip = page.getByTestId('since-last-visit')
  await expect(strip).toBeVisible()
  await expect(strip).toContainText('2 new transactions since')
  await expect(strip).toContainText('$80 spent, $900 in')
  await expect(strip).toContainText('5 days ago')
  // today's date is saved for next time
  expect(await page.evaluate(() => localStorage.getItem('clarity-last-visit'))).toBe(iso(new Date()))
  // moving between screens keeps the same baseline
  await page.goto('./?tab=budgets'); await page.goto('./?tab=dashboard')
  await expect(page.getByTestId('since-last-visit')).toBeVisible()
  await strip.getByRole('button', { name: 'Hide this summary' }).click()
  await expect(page.getByTestId('since-last-visit')).toHaveCount(0)
})

test('Home on a phone shows it too and it fits at 320px', async ({ page }) => {
  await setup(page, iso(daysAgo(3)), 320)
  await page.goto('./?tab=home')
  const strip = page.getByTestId('since-last-visit')
  await expect(strip).toBeVisible()
  await page.waitForTimeout(1000)
  const right = await strip.evaluate((e) => [...e.querySelectorAll('*')].map((c) => c.getBoundingClientRect().right).reduce((a, b) => Math.max(a, b), 0))
  expect(right).toBeLessThanOrEqual(321)
  await page.screenshot({ path: 'test-results/since-visit-320.png' })
})

test('no strip on a first visit, or when you were here today', async ({ page }) => {
  await setup(page, null)
  await page.goto('./?tab=dashboard')
  await page.waitForTimeout(800)
  await expect(page.getByTestId('since-last-visit')).toHaveCount(0)
})
test('no strip when the last visit was today', async ({ page }) => {
  await setup(page, iso(new Date()))
  await page.goto('./?tab=dashboard')
  await page.waitForTimeout(800)
  await expect(page.getByTestId('since-last-visit')).toHaveCount(0)
})

test('blocked browser storage does not break the screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript((s) => {
    try { localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)) } catch { /* ignore */ }
    const orig = Storage.prototype.getItem
    Storage.prototype.getItem = function (k: string) { if (k === 'clarity-last-visit' || k === 'clarity-visit-base') throw new Error('blocked'); return orig.call(this, k) }
  }, SEED)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./?tab=dashboard')
  await page.waitForTimeout(1200)
  await expect(page.getByTestId('since-last-visit')).toHaveCount(0)
  expect(errors).toEqual([])
  expect((await page.locator('body').innerText()).length, 'the Dashboard still renders').toBeGreaterThan(1500)
})
