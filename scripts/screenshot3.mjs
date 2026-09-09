import { chromium } from 'playwright'

const outDir = process.argv[2] || '.'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } })
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForSelector('text=Live Funds Available', { timeout: 10000 })
await page.waitForTimeout(2000)

// Scroll to Periodic Bills section and click Add
await page.getByText('Add periodic bill').click()
await page.waitForTimeout(800)
await page.screenshot({ path: `${outDir}/periodic-add-form-empty.png`, fullPage: true })

// Fill the form (scope all lookups to the <form> — the page also has plain
// number/date-shaped inputs elsewhere, like the HSBC balance field)
await page.fill('input[placeholder="e.g. Water"]', 'Water (usage)')
const dateInputs = await page.$$('form input[type="date"]')
await dateInputs[0].fill('2026-09-01')
await dateInputs[1].fill('2026-11-30')
await page.locator('form input[type="number"]').first().fill('120')
await page.waitForTimeout(300)
await page.screenshot({ path: `${outDir}/periodic-add-form-filled.png`, fullPage: true })

await page.locator('form button[type="submit"]').click()
await page.waitForTimeout(1200)
await page.screenshot({ path: `${outDir}/periodic-after-add.png`, fullPage: true })

// Now edit the newly added bill
await page.locator('button[aria-label="Edit Water (usage)"]').click()
await page.waitForTimeout(600)
await page.screenshot({ path: `${outDir}/periodic-edit-form.png`, fullPage: true })

// Toggle "in credit" on during edit to confirm the credit field appears and math updates
await page.getByText('Account is currently in credit').click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: 'Save changes' }).click()
await page.waitForTimeout(1200)
await page.screenshot({ path: `${outDir}/periodic-after-edit.png`, fullPage: true })

// Remove it
await page.locator('button[aria-label="Remove Water (usage)"]').click()
await page.waitForTimeout(800)
await page.screenshot({ path: `${outDir}/periodic-after-remove.png`, fullPage: true })

await browser.close()
console.log('DONE')
