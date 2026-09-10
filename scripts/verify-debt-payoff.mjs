import { chromium } from 'playwright'
const outDir = process.argv[2] || '.'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
for (const d of ['6', '3', '0', '4']) {
  await page.locator('button', { hasText: d }).first().click()
  await page.waitForTimeout(80)
}
await page.waitForTimeout(1000)
await page.click('[data-tab="debts"]')
await page.waitForTimeout(600)
await page.click('button:has-text("Add debt")')
await page.waitForTimeout(300)
// set balance to 500 so "mark as paid" button appears
const balanceInput = page.locator('input[type="number"]').nth(1) // 0=extra budget, 1=first debt balance
await balanceInput.fill('500')
await balanceInput.dispatchEvent('change')
await page.waitForTimeout(300)
await page.click('button[title="Mark as paid off"]')
await page.waitForTimeout(250) // catch confetti mid-burst
await page.screenshot({ path: `${outDir}/debt-paid-off-confetti.png` })
await browser.close()
console.log('DONE')
