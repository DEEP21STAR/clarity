import { test, expect } from '@playwright/test'

// "Where your income goes" ribbons on the Dashboard. The default demo data has income and bills, so no seed is needed for the normal case.
const SET_UP = { grossAnnualIncome: 90000, country: 'NZ' }
async function open(page: import('@playwright/test').Page, width: number, seed: object = SET_UP) {
  await page.setViewportSize({ width, height: 900 })
  await page.addInitScript((s) => { try { sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)); if (s) localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)) } catch { /* ignore */ } }, seed)
  await page.goto('./?tab=dashboard')
}

test('the ribbon, its summary sentence and a text legend that adds up all show on the Dashboard', async ({ page }) => {
  await open(page, 1440)
  const flow = page.getByTestId('money-flow')
  await expect(flow).toBeVisible()
  expect(await flow.locator('[data-band]').count()).toBeGreaterThanOrEqual(2)
  const summary = (await page.getByTestId('money-flow-summary').innerText()).replace(/\s+/g, ' ')
  expect(summary).toMatch(/\$[\d,.]+ a month/)
  const legend = await page.getByTestId('money-flow-legend').locator('li').allInnerTexts()
  const amounts = legend.map((t) => Number((t.match(/\$([\d,]+(?:\.\d+)?)/) ?? [])[1]?.replace(/,/g, '')))
  expect(amounts.every((n) => Number.isFinite(n) && n > 0), `legend amounts: ${legend.join(' | ')}`).toBe(true)
  expect(await flow.getAttribute('aria-label'), 'the picture has the same sentence as its text alternative').toBeTruthy()
})

test('the ribbon finishes revealing, and is shown at once with reduced motion', async ({ page, browser }) => {
  await open(page, 1440)
  await page.waitForTimeout(1600)
  const w = await page.locator('.money-flow-reveal').evaluate((e) => getComputedStyle(e).transform)
  expect(w === 'none' || w.startsWith('matrix(1,') || w === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true)
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', baseURL: 'http://127.0.0.1:4173/clarity/' })
  const p2 = await ctx.newPage()
  await p2.addInitScript((s) => { try { sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)); localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)) } catch { /* ignore */ } }, SET_UP)
  await p2.goto('./?tab=dashboard')
  expect(await p2.locator('.money-flow-reveal').evaluate((e) => getComputedStyle(e).animationName)).toBe('none')
  await ctx.close()
})

test('bills above income show a Shortfall, in words', async ({ page }) => {
  // a very low income against the default bills
  await open(page, 390, { grossAnnualIncome: 12000, country: 'NZ' })
  const summary = await page.getByTestId('money-flow-summary').innerText()
  expect(summary).toMatch(/more than your/)
  await expect(page.getByTestId('money-flow-legend')).toContainText('Shortfall')
})

for (const w of [320, 390]) {
  test(`nothing runs past the right edge at ${w}px`, async ({ page }) => {
    await open(page, w)
    await page.waitForTimeout(1500)
    const card = page.getByTestId('money-flow').locator('xpath=ancestor::*[contains(@class,"glass-panel") or contains(@class,"label-cut")][1]')
    const right = await card.evaluate((e) => [...e.querySelectorAll('li, p, span')].map((c) => c.getBoundingClientRect().right).reduce((a, b) => Math.max(a, b), 0))
    expect(right).toBeLessThanOrEqual(w + 1)
    await page.getByTestId('money-flow').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `test-results/money-flow-${w}.png` })
  })
}
