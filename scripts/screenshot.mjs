import { chromium } from 'playwright'

const outDir = process.argv[2] || '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
await page.setViewportSize({ width: 1440, height: 1200 })
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(2000) // let boot sequence + GSAP settle

// Upcoming Payments tab is default — screenshot Week view
await page.waitForSelector('text=Live Funds Available', { timeout: 10000 })
await page.waitForTimeout(800)
await page.screenshot({ path: `${outDir}/upcoming-week.png`, fullPage: true })

// Switch to Month view
await page.click('button:has-text("Month")')
await page.waitForTimeout(1200)
await page.screenshot({ path: `${outDir}/upcoming-month.png`, fullPage: true })

// Force overspend: set HSBC balance to a very negative number via the input
const hsbcInputs = await page.$$('input[type="number"]')
// Find the HSBC balance input specifically by locating its container label
const hsbcInput = await page.locator('div:has(> label:text("HSBC")) input[type="number"]').first()
await hsbcInput.fill('-50000')
await hsbcInput.dispatchEvent('change')
await page.waitForTimeout(1500)
await page.screenshot({ path: `${outDir}/upcoming-overspend.png`, fullPage: true })

// Dashboard tab
await page.click('button:has-text("Dashboard")')
await page.waitForTimeout(1200)
await page.screenshot({ path: `${outDir}/dashboard.png`, fullPage: true })

// Budgets tab
await page.click('button:has-text("Budgets")')
await page.waitForTimeout(1000)
await page.screenshot({ path: `${outDir}/budgets.png`, fullPage: true })

// Debts tab
await page.click('button:has-text("Debts")')
await page.waitForTimeout(1000)
await page.screenshot({ path: `${outDir}/debts.png`, fullPage: true })

// Shopping placeholder
await page.click('button:has-text("Shopping")')
await page.waitForTimeout(1000)
await page.screenshot({ path: `${outDir}/shopping.png`, fullPage: true })

await browser.close()
console.log('DONE')
