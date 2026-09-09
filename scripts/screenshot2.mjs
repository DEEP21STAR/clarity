import { chromium } from 'playwright'

const outDir = process.argv[2] || '.'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } })
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForSelector('text=Live Funds Available', { timeout: 10000 })
await page.waitForTimeout(2500) // boot + GSAP settle

await page.screenshot({ path: `${outDir}/upcoming-full-week.png`, fullPage: true })

await page.click('button:has-text("Month")')
await page.waitForTimeout(1500)
await page.screenshot({ path: `${outDir}/upcoming-full-month.png`, fullPage: true })

await browser.close()
console.log('DONE')
