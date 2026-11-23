import { describe, expect, it } from 'vitest'
import { buildWeeklyReview } from './weeklyReview'
import type { Transaction } from './types'
import type { BudgetRow } from './categoryBudgets'

const tx = (date: string, amount: number, category: string): Transaction => ({ id: date + amount + category, date, amount, description: category, category, mode: 'personal' } as Transaction)
const row = (category: string, status: BudgetRow['status'], spent: number, target: number): BudgetRow => ({
  category, monthly: target, carry: 0, target, spent, remaining: target - spent, pctSpent: target ? spent / target : 0,
  pacePct: 0.5, status, daysLeft: 8, perDayLeft: 0, suggested: null, rollover: false,
})
const base = { todayIso: '2026-11-22', budgetRows: [] as BudgetRow[], dailyAllowance: null, daysToPayday: null }

describe('buildWeeklyReview', () => {
  it('nudges toward importing when there is nothing to review', () => {
    const r = buildWeeklyReview({ ...base, transactions: [] })
    expect(r.hasData).toBe(false)
    expect(r.lines[0]).toMatch(/Import a bank statement/)
  })

  it('compares this 7 days with the 7 days before, and names the biggest category', () => {
    const t = [tx('2026-11-20', -60, 'Groceries'), tx('2026-11-18', -40, 'Fuel'), tx('2026-11-12', -50, 'Groceries'), tx('2026-11-21', 900, 'Income')]
    const r = buildWeeklyReview({ ...base, transactions: t })
    expect(r.headline).toBe('You spent $100 in the last 7 days, $50 more than the week before')
    expect(r.lines[1]).toBe('Most of it went on Groceries ($60).')
  })

  it('says less and the same correctly, and never names the uncategorised bucket as the top category', () => {
    expect(buildWeeklyReview({ ...base, transactions: [tx('2026-11-20', -30, 'Food'), tx('2026-11-13', -80, 'Food')] }).headline).toContain('$50 less than the week before')
    expect(buildWeeklyReview({ ...base, transactions: [tx('2026-11-20', -30, 'Food'), tx('2026-11-13', -30, 'Food')] }).headline).toContain('the same as the week before')
    const r = buildWeeklyReview({ ...base, transactions: [tx('2026-11-20', -70, 'uncategorised'), tx('2026-11-20', -5, 'Food')] })
    expect(r.lines[1]).toBe('Most of it went on Food ($5).')
  })

  it('reports budgets that are over, ahead of pace, or all fine', () => {
    const t = [tx('2026-11-20', -10, 'Food')]
    expect(buildWeeklyReview({ ...base, transactions: t, budgetRows: [row('Fuel', 'over', 143, 120)] }).lines.join(' ')).toContain('Fuel is over its monthly target by $23')
    expect(buildWeeklyReview({ ...base, transactions: t, budgetRows: [row('Food', 'watch', 90, 100)] }).lines.join(' ')).toContain('Food is running ahead of pace: $90 of $100 used')
    expect(buildWeeklyReview({ ...base, transactions: t, budgetRows: [row('Food', 'ok', 10, 100)] }).lines.join(' ')).toContain('Every budgeted category is on track')
  })

  it('adds the safe-to-spend line, including the nothing-left case', () => {
    const t = [tx('2026-11-20', -10, 'Food')]
    expect(buildWeeklyReview({ ...base, transactions: t, dailyAllowance: 42.5, daysToPayday: 5 }).lines.at(-1)).toBe('You can spend about $42.5 a day until payday (5 days).')
    expect(buildWeeklyReview({ ...base, transactions: t, dailyAllowance: 0, daysToPayday: 1 }).lines.at(-1)).toMatch(/nothing left to spend freely/)
  })
})
