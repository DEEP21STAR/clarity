// Text clipped inside its own box on a phone (content wider than a box that hides overflow, or gradient text wider than its box:
// the part outside the box paints nothing). Scrolling areas (overflow auto), ellipsis truncation, the ticker and screen-reader text are excluded.
import { test, expect } from '@playwright/test'
import { TABS } from './support/app'
test.use({ reducedMotion: 'reduce' })
function findClipped() {
  const out: string[] = []
  for (const el of document.querySelectorAll<HTMLElement>('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    // content wider than the box, and the box hides it
    const hides = cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.textOverflow === 'ellipsis' || cs.webkitBackgroundClip === 'text'
    if (!hides) continue
    if (el.scrollWidth <= el.clientWidth + 8) continue // a few px of glow/shadow bleed is not clipped text
    if (cs.textOverflow === 'ellipsis') continue // truncation with an ellipsis is deliberate
    if (el.closest('.ticker-wrap, .sr-only, canvas')) continue
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50)
    if (!text) continue
    out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')} [${el.scrollWidth}>${el.clientWidth}] "${text}"`)
  }
  return out.slice(0, 12)
}
for (const WIDTH of [320, 360, 390, 768, 1024]) for (const tab of ['home', ...TABS]) {
  test(`no clipped text on ${tab} at ${WIDTH}px`, async ({ page }) => {
    await page.setViewportSize({ width: WIDTH, height: 844 })
    await page.addInitScript(() => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)) } catch { /* ignore */ } })
    await page.goto(`./?tab=${tab}`)
    await page.waitForTimeout(2200)
    expect(await page.evaluate(findClipped), `clipped text on ${tab} at ${WIDTH}px`).toEqual([])
    // and the page itself must not scroll sideways
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${tab} scrolls sideways at ${WIDTH}px`).toBeLessThanOrEqual(1)
  })
}

// Large amounts: the big hero figure must still fit a 320px card (-$674.94 fits at the full size; -$12,674.94 and -$123,674.94 do not).
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
for (const [label, spent, shape] of [['-$xxx.xx', 300, /-\$\d{3}\.\d{2}/], ['-$12,6xx', 12000, /-\$\d{2,3},\d{3}\.\d{2}/], ['-$123,6xx', 123000, /-\$\d{2,3},\d{3}\.\d{2}/]] as const) {
  for (const tab of ['upcoming', 'home']) {
    test(`a large overspend (${label}) is not clipped on ${tab} at 320px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 844 })
      await page.addInitScript((seed) => { try { localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(seed)); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)) } catch { /* ignore */ } },
        { spendTracker: { food: spent, fuel: 0, personal: 0, periodStart: iso(new Date()) } })
      await page.goto(`./?tab=${tab}`)
      await page.waitForTimeout(2800) // the figure counts up for about a second
      const text = await page.locator('body').innerText()
      expect(text, 'the seeded overspend shows').toMatch(shape)
      expect(await page.evaluate(findClipped), `clipped text on ${tab} with ${label}`).toEqual([])
      // the big figure stays on ONE line (a wrapped number such as '-$12,674.9' / '4' is clipped by nothing but is still broken)
      const lines = await page.evaluate(() => {
        const el = (document.querySelector('[data-testid="live-funds"]') ?? [...document.querySelectorAll('div')].find((d) => /^-?\$[\d,]+\.\d{2}$/.test((d.textContent || '').trim()))) as HTMLElement | null
        if (!el) return -1
        return Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight || getComputedStyle(el).fontSize))
      })
      expect(lines, `the figure on ${tab} wrapped onto ${lines} lines`).toBe(1)
      await page.screenshot({ path: `test-results/hero-large-${tab}-${spent}.png` })
    })
  }
}
