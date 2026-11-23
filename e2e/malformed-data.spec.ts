import { test, expect } from '@playwright/test'
import { TABS, VIEWPORTS } from './support/app'

// Old or hand-edited saved data must never blank the app. Each seed breaks one assumption; every tab must still render real content.
// (A render error caught by the error boundary is not a "pageerror", so the check is for the boundary's panel as well.)
test.use({ reducedMotion: 'reduce' })
const now = new Date(); const pm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
const pym = `${pm.getFullYear()}-${String(pm.getMonth() + 1).padStart(2, '0')}`
const ok = { id: 'ok', date: `${pym}-05`, amount: -20, category: 'Food', description: 'fine', mode: 'personal' }
const SEEDS: Record<string, object> = {
  'no date': { transactions: [ok, { id: '1', amount: -5, category: 'Food' }] },
  'null category': { transactions: [ok, { id: '1', date: `${pym}-05`, amount: -5, category: null }] },
  'no category': { transactions: [ok, { id: '1', date: `${pym}-05`, amount: -5 }] },
  'numeric date': { transactions: [ok, { id: '1', date: 20261105, amount: -5, category: 'Food' }] },
  'text amount': { transactions: [ok, { id: '1', date: `${pym}-05`, amount: '-12.5', category: 'Food' }] },
  'null amount': { transactions: [ok, { id: '1', date: `${pym}-05`, amount: null, category: 'Food' }] },
  'nz-format date': { transactions: [ok, { id: '1', date: '05/11/2026', amount: -5, category: 'Food', description: 'x', mode: 'personal' }] },
  'datetime string': { transactions: [ok, { id: '1', date: `${pym}-05T10:30:00.000Z`, amount: -5, category: 'Food', description: 'x', mode: 'personal' }] },
  'empty strings': { transactions: [ok, { id: '', date: '', amount: -5, category: '', description: '', mode: '' }] },
  'huge amount': { transactions: [ok, { id: '1', date: `${pym}-09`, amount: -1e15, category: 'Food', description: 'x', mode: 'personal' }] },
  'null list': { transactions: null },
  'junk rows': { transactions: [ok, null, 5, 'x'] },
  'bad budgets': { categoryBudgets: { Food: { monthly: 'abc' }, Fuel: null } },
  'null budgets': { categoryBudgets: null },
}

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`malformed saved data @ ${vpName}`, () => {
    test.use({ viewport: vp })
    for (const [name, seed] of Object.entries(SEEDS)) {
      test(`${name}: every tab still renders`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
        await page.addInitScript((s) => { try { localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } }, seed)
        for (const tab of TABS) {
          await page.goto(`./?tab=${tab}`)
          await page.waitForTimeout(900)
          const text = await page.locator('body').innerText()
          expect(text, `${tab}: the error panel appeared`).not.toContain("couldn't load this screen")
          expect(text.trim().length, `${tab}: page is blank`).toBeGreaterThan(200)
        }
        expect(errors).toEqual([])
      })
    }
  })
}
