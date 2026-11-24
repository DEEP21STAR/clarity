import { test, expect } from '@playwright/test'
import { openApp, TABS, VIEWPORTS } from './support/app'

// Interaction audit (PHOENIX rule 9, the fixed-element collision part): scroll each tab to the very bottom at both sizes and check
// that no button, link or field is hidden underneath the floating Add button. Content must be able to scroll clear of it.
test.use({ reducedMotion: 'reduce' })

// Runs inside the page: lists every on-screen control that is mostly hidden under the floating Add button.
function coveredByFab() {
  const fab = [...document.querySelectorAll('button')].find((b) => /^Add an expense or income/.test((b.getAttribute('aria-label') ?? b.textContent ?? '').trim()))
  if (!fab) return { fab: false, covered: [] as string[] }
  const f = fab.getBoundingClientRect()
  if (f.width === 0 || f.height === 0) return { fab: false, covered: [] as string[] }
  const covered: string[] = []
  for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')) {
    if (el === fab || fab.contains(el)) continue
    let r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    // only the part an ancestor scroll box actually shows: a ledger row scrolled out of its own box is clipped, not hidden under the Add button
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const o = getComputedStyle(a)
      if (o.overflowY === 'visible' && o.overflowX === 'visible') continue
      const c = a.getBoundingClientRect()
      r = new DOMRect(Math.max(r.left, c.left), Math.max(r.top, c.top), Math.max(0, Math.min(r.right, c.right) - Math.max(r.left, c.left)), Math.max(0, Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top)))
    }
    if (r.width === 0 || r.height === 0) continue
    // only elements that are actually on screen right now
    if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) continue
    const overlap = Math.max(0, Math.min(r.right, f.right) - Math.max(r.left, f.left)) * Math.max(0, Math.min(r.bottom, f.bottom) - Math.max(r.top, f.top))
    if (overlap > 0.25 * r.width * r.height) covered.push((el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 50))
  }
  return { fab: true, covered }
}


for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`bottom-of-page collisions @ ${vpName}`, () => {
    test.use({ viewport: vp })
    const tabs = vpName === 'phone' ? (['home', ...TABS] as const) : TABS
    for (const tab of tabs) {
      test(`${tab}`, async ({ page }) => {
        await openApp(page, tab)
        await page.waitForTimeout(1500)
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await page.waitForTimeout(500)
        const hidden = await page.evaluate(coveredByFab)
        expect(hidden.covered, `controls hidden under the Add button at the bottom of ${tab}: ${hidden.covered.join(' | ')}`).toEqual([])
      })
    }
  })
}

// The detector must be able to fail: plant a button exactly under the Add button and check that it is reported.
test('the audit really detects a control hidden under the Add button', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop)
  await openApp(page, 'budgets')
  await page.waitForTimeout(800)
  await page.evaluate(() => {
    const fab = [...document.querySelectorAll('button')].find((b) => /^Add an expense or income/.test((b.getAttribute('aria-label') ?? b.textContent ?? '').trim()))!
    const r = fab.getBoundingClientRect()
    const decoy = document.createElement('button')
    decoy.textContent = 'decoy under the add button'
    decoy.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:1`
    document.body.appendChild(decoy)
  })
  const res = await page.evaluate(coveredByFab)
  expect(res.covered).toContain('decoy under the add button')
})

// Regression: a CSS filter on an ancestor (colour drift, time-of-day tint) silently turns it into the anchor of every fixed child,
// which pinned the Add button to the end of the page instead of the screen. It must float over the viewport with motion on or off.
for (const motion of ['reduce', 'no-preference'] as const) {
  test(`the Add button floats over the screen at scroll 0 (motion: ${motion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: motion })
    await page.setViewportSize(VIEWPORTS.desktop)
    await openApp(page, 'budgets')
    await page.waitForTimeout(1500)
    const box = await page.getByRole('button', { name: /^Add an expense or income/ }).boundingBox()
    expect(box, 'Add button should be rendered').not.toBeNull()
    expect(box!.y + box!.height).toBeLessThanOrEqual(VIEWPORTS.desktop.height)
    const filtered = await page.evaluate(() => {
      const out: string[] = []
      if (!document.querySelector('button[aria-keyshortcuts="N"]')) return ['Add button not found']
      for (let e = document.querySelector('button[aria-keyshortcuts="N"]')?.parentElement; e && e !== document.documentElement; e = e.parentElement) {
        if (getComputedStyle(e).filter !== 'none') out.push(e.tagName + '.' + String(e.className).slice(0, 30))
      }
      return out
    })
    expect(filtered, 'no ancestor of the Add button may have a CSS filter').toEqual([])
  })
}
