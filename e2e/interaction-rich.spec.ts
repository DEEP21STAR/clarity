import { test, expect } from '@playwright/test'
import { TABS, VIEWPORTS } from './support/app'

// Same bottom-of-page check as interaction.spec.ts, but on realistic data: pages are much longer (Category Budgets rows, recap,
// transaction lists) so more controls end up near the floating Add button.
test.use({ reducedMotion: 'reduce' })
const now = new Date()
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const THIS = ym(now); const PREV = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1))
const cats = ['Groceries & household supplies', 'Fuel', 'Eating out and takeaways', 'Subscriptions and memberships', 'Entertainment', 'Health and pharmacy', 'Clothing', 'Rent', 'Utilities']
let id = 0
const tx = (m: string, day: string, amount: number, category: string, description: string) => ({ id: 't' + id++, date: `${m}-${day}`, amount, description, category, mode: 'personal' })
const txs = [
  ...cats.flatMap((c, i) => [tx(PREV, '05', -(120 + i * 233.45), c, 'Very long merchant name pty ltd trading as something wordy ' + i), tx(PREV, '18', -(45.5 + i * 17), c, 'Second purchase')]),
  ...cats.flatMap((c, i) => [tx(THIS, '01', -(60 + i * 111.11), c, 'This month purchase at a long named store ' + i)]),
  tx(PREV, '25', 4850.5, 'Income', 'Salary from an employer with a rather long name'), tx(THIS, '01', 1250, 'Income', 'Pay'),
]
const SEED = { transactions: txs, categoryBudgets: Object.fromEntries(cats.map((c, i) => [c, { monthly: 150 + i * 90, rollover: i % 2 === 0 }])) }
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
  for (const tab of vpName === 'phone' ? (['home', ...TABS] as const) : TABS) {
    test(`rich data: nothing hidden under the Add button at the bottom of ${tab} @ ${vpName}`, async ({ page }) => {
      await page.setViewportSize(vp)
      await page.addInitScript((s) => { try { localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)) } catch { /* ignore */ } }, SEED)
      await page.goto(`./?tab=${tab}`)
      await page.waitForTimeout(2200)
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await page.waitForTimeout(500)
      const hidden = await page.evaluate(coveredByFab)
      expect(hidden.covered, `controls hidden under the Add button at the bottom of ${tab}: ${hidden.covered.join(' | ')}`).toEqual([])
    })
  }
}
