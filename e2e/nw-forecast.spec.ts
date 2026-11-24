import { test, expect, type Page } from '@playwright/test'

// Net Worth tab: "Next 6 months, at this pace".
const SET_UP = { grossAnnualIncome: 90000, country: 'NZ' }
async function open(page: Page, width: number, seed: object = SET_UP) {
  await page.setViewportSize({ width, height: 900 })
  await page.addInitScript((s) => { try { sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)); localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)) } catch { /* ignore */ } }, seed)
  await page.goto('./?tab=networth')
}

test('shows a six-month headline, the rule behind it, and a chart with a text alternative', async ({ page }) => {
  await open(page, 1440)
  const head = page.getByTestId('nw-forecast-headline')
  await expect(head).toBeVisible()
  await expect(head).toContainText('in 6 months')
  await expect(page.getByText(/Each month adds \$[\d,.]+: your income after tax minus your active bills/)).toBeVisible()
  const label = await page.getByTestId('nw-forecast-chart').getAttribute('aria-label')
  expect(label).toMatch(/^Net worth forecast: Now -?\$[\d,.]+, [A-Z][a-z]{2} /)
  await expect(page.getByText(/not a prediction/)).toBeVisible()
  await expect(page.locator('[data-testid="nw-forecast-chart"] .recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value').first()).toBeVisible()
  const ticks = await page.locator('[data-testid="nw-forecast-chart"] .recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value').allInnerTexts()
  expect(ticks.length).toBeGreaterThan(1)
  expect(ticks.filter((t) => /\$-/.test(t)), `axis labels put the minus after the dollar sign: ${ticks.join(' ')}`).toEqual([])
  await expect(page.locator('[data-testid="nw-forecast-chart"] .recharts-area-curve')).toHaveCount(1)
})

test('says bills are more than income when they are', async ({ page }) => {
  await open(page, 390, { grossAnnualIncome: 12000, country: 'NZ' })
  await expect(page.getByText(/Each month takes away \$[\d,.]+: your bills are more than your income after tax/)).toBeVisible()
  await expect(page.getByTestId('nw-forecast-headline')).toContainText('down')
})

test('no card without an income', async ({ page }) => {
  await open(page, 390, { grossAnnualIncome: 0, country: 'NZ' })
  await page.waitForTimeout(800)
  await expect(page.getByTestId('nw-forecast-headline')).toHaveCount(0)
})

for (const w of [320, 390]) {
  test(`fits at ${w}px with nothing past the right edge`, async ({ page }) => {
    await open(page, w)
    await page.waitForTimeout(1800)
    const card = page.getByTestId('nw-forecast-headline').locator('xpath=ancestor::*[contains(@class,"glass-panel") or contains(@class,"label-cut")][1]')
    const right = await card.evaluate((e) => [...e.querySelectorAll('p, span, svg')].map((c) => c.getBoundingClientRect().right).reduce((a, b) => Math.max(a, b), 0))
    expect(right).toBeLessThanOrEqual(w + 1)
    await page.getByTestId('nw-forecast-chart').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `test-results/nw-forecast-${w}.png` })
  })
}
