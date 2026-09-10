import { chromium } from 'playwright'
const outDir = process.argv[2] || '.'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } })
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
for (const d of ['6', '3', '0', '4']) {
  await page.locator('button', { hasText: d }).first().click()
  await page.waitForTimeout(80)
}
await page.waitForTimeout(1000)
await page.click('[data-tab="tools"]')
await page.waitForTimeout(800)
// Click the JSON export button (no real downloads capability in this local preview -> should fall back to clipboard copy)
await page.click('button:has-text("Save full JSON export")')
await page.waitForTimeout(500)
await page.screenshot({ path: `${outDir}/tools-export-panel.png`, fullPage: true })
await browser.close()
console.log('DONE')
