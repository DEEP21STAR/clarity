// Text clipped inside its own box on a phone (content wider than a box that hides overflow, or gradient text wider than its box:
// the part outside the box paints nothing). Scrolling areas (overflow auto), ellipsis truncation, the ticker and screen-reader text are excluded.
import { test, expect } from '@playwright/test'
import { TABS } from './support/app'
test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
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
for (const tab of ['home', ...TABS]) {
  test(`no clipped text on ${tab} at phone width`, async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)) } catch { /* ignore */ } })
    await page.goto(`./?tab=${tab}`)
    await page.waitForTimeout(2200)
    expect(await page.evaluate(findClipped), `clipped text on ${tab}`).toEqual([])
  })
}
