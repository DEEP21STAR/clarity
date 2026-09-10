import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
for (const digit of ['6', '3', '0', '4']) {
  await page.locator(`button`, { hasText: new RegExp(`^${digit}$`) }).first().click()
  await page.waitForTimeout(200)
}
await page.waitForTimeout(1500)

const combined = page.locator('button:has-text("Combined")').first()
await combined.click()
await page.waitForTimeout(800)

const info = await combined.evaluate((el) => {
  const parent = el.parentElement
  const thumb = Array.from(parent.children).find(c => c !== el && c.tagName !== 'BUTTON')
  const results = { parentHTML: parent.outerHTML.slice(0, 1500) }
  if (thumb) {
    const s = getComputedStyle(thumb)
    results.thumbBg = s.backgroundColor
    results.thumbBgImage = s.backgroundImage
    results.thumbFilter = s.filter
    results.thumbOpacity = s.opacity
  }
  const btnStyle = getComputedStyle(el)
  results.textShadow = btnStyle.textShadow
  results.filter = btnStyle.filter
  results.fontWeight = btnStyle.fontWeight
  return results
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
