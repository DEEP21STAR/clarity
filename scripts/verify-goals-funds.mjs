import { chromium } from 'playwright'
const outDir = process.argv[2] || '.'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } })
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
for (const d of ['6', '3', '0', '4']) {
  await page.locator('button', { hasText: d }).first().click()
  await page.waitForTimeout(80)
}
await page.waitForTimeout(1000)

// Savings goal
await page.click('button:has-text("Add goal")')
await page.waitForTimeout(300)
await page.fill('input[placeholder="e.g. Christmas"]', 'New Laptop')
const goalInputs = await page.$$('form input[type="number"], div:has-text("Add Savings Goal") input[type="number"]')
await page.locator('input[placeholder="e.g. Christmas"]').evaluate(() => {}) // noop to keep chain
// target amount is the first number input after the name field within the Add Savings Goal card
const goalCard = page.locator('div:has(> div > span:text("Add Savings Goal"))').first()
await page.locator('input[type="number"]').first().fill('2000')
await page.getByRole('button', { name: 'Add goal' }).last().click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${outDir}/savings-goal-added.png` })

// Sinking fund
await page.click('button:has-text("Add irregular expense")')
await page.waitForTimeout(300)
await page.fill('input[placeholder="e.g. Car WOF & Rego"]', 'Car WOF & Rego')
await page.locator('input[type="number"]').first().fill('700')
await page.locator('input[type="date"]').first().fill('2026-12-01')
await page.getByRole('button', { name: 'Add fund' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${outDir}/sinking-fund-added.png`, fullPage: true })

await browser.close()
console.log('DONE')
