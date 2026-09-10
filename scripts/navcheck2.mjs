import { chromium } from 'playwright'
const OUT = '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad/contrast-check'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
for (const digit of ['6', '3', '0', '4']) {
  await page.locator(`button`, { hasText: new RegExp(`^${digit}$`) }).first().click()
  await page.waitForTimeout(200)
}
await page.waitForTimeout(1500)
const tabs = ['Dashboard','Upcoming Payments','Net Worth','Calendar','Transactions','Budgets','Debts','Shopping & Expenses','Tools']
for (const t of tabs) {
  await page.locator(`nav button:has-text("${t}")`).first().click().catch(() => {})
  await page.waitForTimeout(1400)
}
await page.locator(`nav button:has-text("Dashboard")`).first().click()
await page.waitForTimeout(800)

await page.keyboard.down('Meta')
await page.keyboard.press('k')
await page.keyboard.up('Meta')
await page.waitForTimeout(500)
// hover the Budgets row this time (should be cached from the loop above)
const row = page.locator('text=Go to Budgets').first()
await row.hover()
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/palette-hover-budgets.png` })
await browser.close()
