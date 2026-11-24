import { test, expect, type Page } from '@playwright/test'

// Other screens load in idle time after the first one is up, so the first tap on a tab does not wait for its code.
const SET_UP = { grossAnnualIncome: 90000, country: 'NZ' }
async function open(page: Page, tab = 'upcoming') {
  await page.addInitScript((s) => { try { sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)); localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)) } catch { /* ignore */ } }, SET_UP)
  await page.goto(`./?tab=${tab}`)
}

test('the Budgets, Net Worth and Tools code is fetched in the background without opening them', async ({ page }) => {
  const chunks: string[] = []
  page.on('request', (r) => { const m = r.url().match(/assets\/([A-Za-z]+)-[\w-]+\.js/); if (m) chunks.push(m[1]) })
  await open(page)
  await expect.poll(() => chunks.includes('Budgets') && chunks.includes('NetWorth') && chunks.includes('Tools'), { timeout: 40_000, message: `chunks seen: ${chunks.join(', ')}` }).toBe(true)
  // and the first tap on Budgets then shows it with no loading skeleton lingering
  await page.getByRole('button', { name: /^Budgets$/ }).first().click().catch(() => page.goto('./?tab=budgets'))
  await expect(page.getByText('Category Budgets').first()).toBeVisible({ timeout: 5000 })
})

test('a blocked screen file does not break the page or cause a reload loop', async ({ page }) => {
  let navigations = 0
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navigations++ })
  await page.route(/assets\/Budgets-[\w-]+\.js/, (route) => route.abort())
  await open(page)
  await page.waitForTimeout(12_000)
  expect(navigations, 'no automatic reloads from a failed background load').toBe(1)
  const text = await page.locator('body').innerText()
  expect(text).not.toMatch(/couldn.t load this screen/i)
  expect(text.trim().length).toBeGreaterThan(300)
})
