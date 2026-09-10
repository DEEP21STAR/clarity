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
await page.locator(`nav button:has-text("Upcoming Payments")`).first().click()
await page.waitForTimeout(1200)
const nav = page.locator('nav').first()
await nav.screenshot({ path: `${OUT}/nav-fresh-verify.png` })
await browser.close()
