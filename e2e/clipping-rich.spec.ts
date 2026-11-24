import { test, expect } from '@playwright/test'
import { TABS } from './support/app'
// The default-data audits never render the Category Budgets rows, the monthly recap or realistic transaction lists. This seed has long
// category and merchant names, ten categories with targets (half with rollover), two months of spending and a large income.
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
function findClipped() {
  const out: string[] = []
  for (const el of document.querySelectorAll<HTMLElement>('body *')) {
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue
    const hides = cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.webkitBackgroundClip === 'text'
    if (!hides || el.scrollWidth <= el.clientWidth + 8 || cs.textOverflow === 'ellipsis') continue
    if (el.closest('.ticker-wrap, .sr-only, canvas')) continue
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60); if (!text) continue
    out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')} [${el.scrollWidth}>${el.clientWidth}] "${text}"`)
  }
  return out.slice(0, 10)
}
for (const W of [320, 390]) for (const tab of ['home', ...TABS]) test(`rich data: no clipped text or sideways scroll on ${tab} at ${W}px`, async ({ page }) => {
  await page.setViewportSize({ width: W, height: 844 })
  await page.addInitScript((s) => { try { localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)) } catch { /* ignore */ } }, SEED)
  await page.goto(`./?tab=${tab}`)
  await page.waitForTimeout(2500)
  expect(await page.evaluate(findClipped), `clipped text on ${tab} at ${W}px`).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${tab} scrolls sideways at ${W}px`).toBeLessThanOrEqual(1)
})
