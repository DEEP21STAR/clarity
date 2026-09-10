import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const pinButtons = page.locator('button:has-text("6")').first()
if (await pinButtons.isVisible({ timeout: 2000 }).catch(() => false)) {
  console.log('PIN gate detected, clicking 6304')
  for (const digit of ['6', '3', '0', '4']) {
    await page.locator(`button`, { hasText: new RegExp(`^${digit}$`) }).first().click()
    await page.waitForTimeout(200)
  }
  await page.waitForTimeout(1500)
}

const combined = page.locator('button:has-text("Combined")').first()
await combined.waitFor({ timeout: 10000 })
await combined.click()
await page.waitForTimeout(800)

const box = await combined.boundingBox()
await page.screenshot({ path: '/tmp/claude-1000/-home-deep/9d98deb9-2c4e-4425-b219-a1a8c0645978/scratchpad/contrast-check/combined-pill.png', clip: { x: Math.max(0, box.x - 30), y: Math.max(0, box.y - 30), width: box.width + 60, height: box.height + 60 } })

const colors = await combined.evaluate((el) => {
  const style = getComputedStyle(el)
  const span = el.querySelector('span') || el
  const spanStyle = getComputedStyle(span)
  return {
    buttonColor: style.color,
    buttonBg: style.backgroundColor,
    buttonBgImage: style.backgroundImage,
    innerHTML: el.innerHTML.slice(0, 500),
  }
})
console.log(JSON.stringify(colors, null, 2))

await browser.close()
