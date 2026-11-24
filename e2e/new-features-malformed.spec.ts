import { test, expect } from '@playwright/test'

// The newest cards (income ribbons, trend lines and pace, since-last-visit strip, net worth forecast) must survive rows with missing or
// wrong-typed fields without an error card or a blank screen. Seeds: odd bills, odd budgets, odd transactions, odd accounts.
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const ago = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d }
const SEEDS: Record<string, object> = {
  'bills with no amount, frequency or category': { grossAnnualIncome: 90000, country: 'NZ', bills: [{ id: 'b1', name: 'Odd', active: true }, { id: 'b2', name: 'Text amount', active: true, amount: 'lots', frequency: 'sometimes', category: 'zzz' }, null] },
  'budgets with bad numbers': { grossAnnualIncome: 90000, country: 'NZ', categoryBudgets: { Food: { monthly: 'x' }, Fuel: { monthly: -5 }, Odd: null, Big: { monthly: 1e15 } } },
  'transactions with bad dates and amounts': { grossAnnualIncome: 90000, country: 'NZ', transactions: [{ id: 't1', date: 'garbage', amount: -10, category: 'Food' }, { id: 't2', date: iso(ago(1)), amount: 'ten', category: 'Food' }, { id: 't3', date: iso(ago(2)), amount: -20 }, null, 7] },
  'accounts and income missing': { country: 'NZ', accounts: [null, { id: 'a', value: 'x' }], grossAnnualIncome: 'a lot' },
  'a stale last-visit date': { grossAnnualIncome: 90000, country: 'NZ', transactions: [{ id: 't1', date: iso(ago(1)), amount: -20, category: 'Food', mode: 'combined' }] },
}

for (const [name, seed] of Object.entries(SEEDS)) {
  for (const tab of ['dashboard', 'budgets', 'networth', 'home']) {
    test(`${name}: ${tab} renders with no error card`, async ({ page }) => {
      await page.setViewportSize({ width: tab === 'home' ? 390 : 1440, height: 900 })
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.addInitScript(([s, last]) => { try { sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)); localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)); localStorage.setItem('clarity-last-visit', last as string) } catch { /* ignore */ } }, [seed, iso(ago(6))] as const)
      await page.goto(`./?tab=${tab}`)
      await page.waitForTimeout(1800)
      const text = await page.locator('body').innerText()
      expect(text, 'no error panel').not.toMatch(/couldn.t load this screen|something went wrong/i)
      expect(await page.locator('#clarity-diagnostic').count(), 'no watchdog panel').toBe(0)
      expect(text.trim().length, 'not blank').toBeGreaterThan(300)
      expect(errors, 'no uncaught errors').toEqual([])
    })
  }
}
