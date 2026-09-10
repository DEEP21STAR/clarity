import { chromium } from 'playwright'

const outDir = process.argv[2] || '.'
const browser = await chromium.launch()

// ---------- PIN gate flow ----------
{
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800) // boot sequence
  await page.waitForSelector('text=Enter your PIN', { timeout: 10000 })
  await page.screenshot({ path: `${outDir}/pin-gate-empty.png` })

  // Wrong PIN
  for (const d of ['1', '1', '1', '1']) await page.click(`button:has-text("${d}")`, { exact: false })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${outDir}/pin-gate-wrong.png` })
  await page.waitForTimeout(700) // rejection reset

  // Correct PIN 6304
  for (const d of ['6', '3', '0', '4']) {
    const btn = page.locator('button', { hasText: d }).first()
    await btn.click()
    await page.waitForTimeout(80)
  }
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${outDir}/pin-gate-unlocked.png` })

  // Confirm reload within session does NOT require re-entry
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const stillLocked = await page.locator('text=Enter your PIN').count()
  console.log('RELOAD_STILL_LOCKED_COUNT=' + stillLocked)
  await page.screenshot({ path: `${outDir}/pin-gate-after-reload.png` })
  await page.close()
}

// ---------- Main app, desktop ----------
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } })
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  // unlock
  for (const d of ['6', '3', '0', '4']) {
    const btn = page.locator('button', { hasText: d }).first()
    await btn.click()
    await page.waitForTimeout(80)
  }
  await page.waitForTimeout(1000)

  // Dashboard — health score + mood icon
  await page.click('[data-tab="dashboard"]')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${outDir}/dashboard-health.png`, fullPage: true })

  // Net Worth tab — chart + accounts
  await page.click('[data-tab="networth"]')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${outDir}/networth-tab.png`, fullPage: true })

  // Calendar tab
  await page.click('[data-tab="calendar"]')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${outDir}/calendar-tab.png`, fullPage: true })

  // Budgets — donut chart
  await page.click('[data-tab="budgets"]')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${outDir}/budgets-donut.png`, fullPage: true })

  // Debts — mark as paid confetti
  await page.click('[data-tab="debts"]')
  await page.waitForTimeout(600)
  const addDebtBtn = page.locator('button:has-text("Add debt")')
  await addDebtBtn.click()
  await page.waitForTimeout(500)
  // Fill balance so "mark as paid" button appears
  const balanceInputs = await page.$$('input[type="number"]')
  // find the newest debt row's balance input (last one before extra-budget input which comes first in DOM actually before list) - just set first debt row found
  const rows = await page.$$('div.rounded-xl.border.border-white\\/10.bg-black\\/30');
  await page.screenshot({ path: `${outDir}/debts-before-mark-paid.png`, fullPage: true })

  // Upcoming Payments — Cash flow chart, spend pace, savings goals, sinking funds, household split
  await page.click('[data-tab="upcoming"]')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${outDir}/upcoming-full-round3.png`, fullPage: true })

  // Trigger overspend -> positive confetti: set HSBC very negative then back to positive
  const hsbcInput = page.locator('div:has(> label:text("HSBC")) input[type="number"]').first()
  await hsbcInput.fill('-50000')
  await hsbcInput.dispatchEvent('change')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${outDir}/upcoming-overspend-round3.png`, fullPage: true })
  await hsbcInput.fill('50000')
  await hsbcInput.dispatchEvent('change')
  await page.waitForTimeout(600) // catch the confetti burst mid-flight
  await page.screenshot({ path: `${outDir}/confetti-positive-again.png`, fullPage: true })
  await hsbcInput.fill('0')
  await hsbcInput.dispatchEvent('change')

  // Command palette
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyK')
  await page.keyboard.up('Control')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${outDir}/command-palette.png` })
  await page.keyboard.press('Escape')

  await page.close()
}

// ---------- Mobile viewport pass ----------
{
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  for (const d of ['6', '3', '0', '4']) {
    const btn = page.locator('button', { hasText: d }).first()
    await btn.click()
    await page.waitForTimeout(80)
  }
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${outDir}/mobile-upcoming.png`, fullPage: true })
  await page.click('[data-tab="dashboard"]')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${outDir}/mobile-dashboard.png`, fullPage: true })
  await page.close()
}

await browser.close()
console.log('DONE')
