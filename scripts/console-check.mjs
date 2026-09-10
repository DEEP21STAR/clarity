import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
const errors = []
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
page.on('pageerror', (err) => errors.push('pageerror: ' + err.message))
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
for (const d of ['6', '3', '0', '4']) {
  await page.locator('button', { hasText: d }).first().click()
  await page.waitForTimeout(80)
}
await page.waitForTimeout(1000)
const tabs = ['dashboard', 'upcoming', 'networth', 'calendar', 'transactions', 'budgets', 'debts', 'shopping', 'tools']
for (const t of tabs) {
  await page.click(`[data-tab="${t}"]`)
  await page.waitForTimeout(600)
}
console.log('ERROR_COUNT=' + errors.length)
if (errors.length) console.log(JSON.stringify(errors, null, 2))
await browser.close()
