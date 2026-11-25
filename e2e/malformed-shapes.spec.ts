import { test, expect } from '@playwright/test'
import { TABS } from './support/app'

// Saved data with rows that are missing fields or hold the wrong types, in every list the app keeps. Each case must leave every screen
// readable: no "couldn't load this screen", no blank page. (Found by fuzzing: ~70 of these used to crash whole screens.)
const BASE = { country: 'NZ', grossAnnualIncome: 90000 }
const CASES: Record<string, object> = {
  'debt with no fields': { debts: [{ id: 'd1' }] },
  'debt with text numbers': { debts: [{ id: 'd1', name: 'x', balance: 'a', apr: 'b', minPayment: 'c' }] },
  'card with no fields': { creditCards: [{ id: 'c1' }] },
  'card with text numbers': { creditCards: [{ id: 'c1', name: 'x', balance: 'a', availableToSpend: 'b' }] },
  'goal with no fields': { savingsGoals: [{ id: 'g1' }] },
  'goal with text numbers and bad date': { savingsGoals: [{ id: 'g1', name: 'x', targetAmount: 'a', contributedAmount: 'b', targetDate: 'nope' }] },
  'sinking fund with no fields': { sinkingFunds: [{ id: 's1' }] },
  'sinking fund with a bad date': { sinkingFunds: [{ id: 's1', name: 'x', targetAmount: 100, currentSaved: 0, targetDate: 'nope' }] },
  'periodic bill with no fields': { periodicBills: [{ id: 'p1' }] },
  'periodic bill with a bad pending bill': { periodicBills: [{ id: 'p1', name: 'x', pendingBill: { amount: 'a', dueDate: 'nope', periodStart: 'x', periodEnd: 'y' } }] },
  'one-off entries with bad fields': { oneOffEntries: [{ id: 'o1' }, { id: 'o2', date: 'nope', amount: 'a' }] },
  'device repayment with no fields': { deviceRepayments: [{ id: 'r1' }] },
  'account with no fields': { accounts: [{ id: 'a1' }] },
  'null rows in every list': { accounts: [null], debts: [null], creditCards: [null], savingsGoals: [null], sinkingFunds: [null], periodicBills: [null], bills: [null], transactions: [null], netWorthHistory: [null], paymentRecords: [null] },
  'net worth history with bad rows': { netWorthHistory: [{ date: 'nope', netWorth: 'x' }, {}] },
  'health score history with bad rows': { healthScoreHistory: [{ date: 1, score: 'x' }] },
  'payment records with bad rows': { paymentRecords: [{ id: 'p' }, { id: 'q', date: 'nope', amount: 'a' }] },
  'card order that is not a list': { dashboardCardOrder: 'oops' },
  'card order with nulls': { dashboardCardOrder: [null, 'x'] },
  'spend tracker with text': { spendTracker: { food: 'a' } },
  'spend tracker missing': { spendTracker: null },
  'income anchor with a bad date': { incomeAnchor: { date: 'nope' } },
  'income anchor missing': { incomeAnchor: null },
  'streak missing': { streak: null },
  'streak empty object': { streak: {} },
  'streak text': { streak: 'x' },
  'streak with wrong field types': { streak: { current: 'x', best: null, lastCheckedDate: 5, milestonesHit: null } },
  'bill with no due day, text amount, unknown frequency': { bills: [{ id: 'b1', name: 'Odd', active: true }, { id: 'b2', name: 'T', active: true, amount: 'lots', frequency: 'sometimes', category: 'zzz' }] },
}

for (const [name, extra] of Object.entries(CASES)) {
  test(`damaged saved data (${name}): every screen still renders`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, serviceWorkers: 'block', baseURL: process.env.PW_BASE ?? 'http://127.0.0.1:4173/clarity/' })
    await ctx.addInitScript((s) => { try { sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)); localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)) } catch { /* ignore */ } }, { ...BASE, ...extra })
    const bad: string[] = []
    for (const tab of [...TABS, 'home']) {
      const page = await ctx.newPage()
      await page.goto(`./?tab=${tab}`)
      await page.waitForTimeout(700)
      const text = await page.locator('body').innerText()
      if (/couldn.t load this screen|something went wrong/i.test(text) || text.trim().length < 200) bad.push(tab)
      await page.close()
    }
    await ctx.close()
    expect(bad, `screens that failed with "${name}"`).toEqual([])
  })
}
