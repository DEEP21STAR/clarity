import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { TABS, VIEWPORTS } from './support/app'

// axe on realistic data: the Category Budgets rows, status chips, progress bars and the monthly recap only exist with transactions and budgets.
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
for (const [vpName, vp] of Object.entries(VIEWPORTS)) for (const tab of ['home', ...TABS]) {
  if (tab === 'home' && vpName === 'desktop') continue
  test(`axe with rich data: ${tab} @ ${vpName}`, async ({ page }) => {
    await page.setViewportSize(vp)
    await page.addInitScript((s) => { try { localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)) } catch { /* ignore */ } }, SEED)
    await page.goto(`./?tab=${tab}`)
    await page.waitForTimeout(2500)
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    expect(r.violations.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes[0].target.join(' ')} :: ${v.nodes[0].html.slice(0, 220)}`), `axe violations on ${tab} @ ${vpName}`).toEqual([])
  })
}
