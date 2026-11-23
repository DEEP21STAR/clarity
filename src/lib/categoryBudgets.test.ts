import { describe, expect, it } from 'vitest'
import { computeBudgetRows, daysInMonth, previousMonth, spentInMonth, suggestTarget, trimSaving, withBudget } from './categoryBudgets'
import type { Transaction } from './types'

const tx = (date: string, amount: number, category: string, id = `${date}-${amount}-${category}`): Transaction => ({ id, date, amount, description: category, category, mode: 'personal' } as Transaction)

describe('month helpers', () => {
  it('knows month lengths and the previous month, across a year boundary', () => {
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
    expect(daysInMonth('2026-11')).toBe(30)
    expect(previousMonth('2026-11')).toBe('2026-10')
    expect(previousMonth('2026-01')).toBe('2025-12')
  })
  it('sums only spend in that category and month', () => {
    const t = [tx('2026-11-03', -20, 'Food'), tx('2026-11-09', -30.5, 'Food'), tx('2026-11-09', -99, 'Fuel'), tx('2026-10-30', -50, 'Food'), tx('2026-11-10', 500, 'Food')]
    expect(spentInMonth(t, 'Food', '2026-11')).toBe(50.5)
  })
})

describe('computeBudgetRows', () => {
  const txs = [tx('2026-11-02', -40, 'Food'), tx('2026-11-10', -40, 'Food'), tx('2026-11-11', -30, 'Fuel'), tx('2026-10-05', -200, 'Food'), tx('2026-10-06', -60, 'Fuel')]
  it('marks a category on pace as ok, ahead of pace as watch, and beyond target as over', () => {
    // 22 Nov = day 22 of 30 -> pace 73%
    const rows = computeBudgetRows({ Food: { monthly: 200 }, Fuel: { monthly: 35 } }, txs, '2026-11-22')
    const food = rows.find((r) => r.category === 'Food')!
    const fuel = rows.find((r) => r.category === 'Fuel')!
    expect(food.spent).toBe(80); expect(food.status).toBe('ok'); expect(food.remaining).toBe(120)
    expect(fuel.status).toBe('watch') // 30 of 35 = 86%, well ahead of 73% pace
    const over = computeBudgetRows({ Fuel: { monthly: 25 } }, txs, '2026-11-22').find((r) => r.category === 'Fuel')!
    expect(over.status).toBe('over'); expect(over.remaining).toBe(-5); expect(over.perDayLeft).toBe(0)
  })
  it('spreads what is left across the remaining days including today', () => {
    const food = computeBudgetRows({ Food: { monthly: 200 } }, txs, '2026-11-22').find((r) => r.category === 'Food')!
    expect(food.daysLeft).toBe(8)
    expect(food.perDayLeft).toBe(13.33) // 120 / 9
  })
  it('lists unbudgeted spending categories with a suggestion from history, and never the uncategorised bucket', () => {
    const rows = computeBudgetRows({}, [...txs, tx('2026-11-12', -9, 'uncategorised')], '2026-11-22')
    expect(rows.map((r) => r.category).sort()).toEqual(['Food', 'Fuel'])
    expect(rows.every((r) => r.status === 'unset')).toBe(true)
    expect(rows.find((r) => r.category === 'Food')!.suggested).toBe(200)
    expect(rows.find((r) => r.category === 'Fuel')!.suggested).toBe(60)
  })
  it('puts the most worrying categories first', () => {
    const rows = computeBudgetRows({ Food: { monthly: 200 }, Fuel: { monthly: 25 } }, txs, '2026-11-22')
    expect(rows.map((r) => r.category)).toEqual(['Fuel', 'Food'])
  })
  it('rollover carries last month\'s unspent amount only when it is switched on and there was history', () => {
    const on = computeBudgetRows({ Food: { monthly: 300, rollover: true } }, txs, '2026-11-22').find((r) => r.category === 'Food')!
    expect(on.carry).toBe(100); expect(on.target).toBe(400)
    const off = computeBudgetRows({ Food: { monthly: 300 } }, txs, '2026-11-22').find((r) => r.category === 'Food')!
    expect(off.carry).toBe(0); expect(off.target).toBe(300)
    const noHistory = computeBudgetRows({ Food: { monthly: 300, rollover: true } }, [tx('2026-11-02', -40, 'Food')], '2026-11-22').find((r) => r.category === 'Food')!
    expect(noHistory.carry).toBe(0)
  })
  it('copes with day 1, the last day, and an empty ledger', () => {
    expect(computeBudgetRows({ Food: { monthly: 100 } }, [], '2026-11-01')[0].status).toBe('ok')
    expect(computeBudgetRows({ Food: { monthly: 100 } }, [], '2026-11-30')[0].daysLeft).toBe(0)
    expect(computeBudgetRows({}, [], '2026-11-15')).toEqual([])
  })
})

describe('suggestTarget and withBudget', () => {
  it('averages up to three prior months and rounds up to $10, with a floor', () => {
    const t = [tx('2026-10-05', -41, 'Fun'), tx('2026-09-05', -39, 'Fun'), tx('2026-08-05', -20, 'Fun')]
    expect(suggestTarget(t, 'Fun', '2026-11-22')).toBe(40) // avg 33.3 -> 40
    expect(suggestTarget([tx('2026-10-05', -3, 'Tiny')], 'Tiny', '2026-11-22')).toBe(10)
    expect(suggestTarget([], 'None', '2026-11-22')).toBeNull()
  })
  it('sets, updates and clears targets without mutating the original', () => {
    const a = {}
    const b = withBudget(a, 'Food', { monthly: 250.456 })
    expect(a).toEqual({}); expect(b).toEqual({ Food: { monthly: 250.46 } })
    const c = withBudget(b, 'Food', { rollover: true })
    expect(c.Food).toEqual({ monthly: 250.46, rollover: true })
    expect(withBudget(c, 'Food', { monthly: 0 })).toEqual({})
  })
})

describe('trimSaving', () => {
  it('works out a 10% trim per month and per year', () => {
    expect(trimSaving(400)).toEqual({ perMonth: 40, perYear: 480 })
    expect(trimSaving(123.45)).toEqual({ perMonth: 12.35, perYear: 148.2 })
    expect(trimSaving(200, 0.25)).toEqual({ perMonth: 50, perYear: 600 })
  })
  it('gives nothing for no target or nonsense percentages', () => {
    expect(trimSaving(0)).toBeNull()
    expect(trimSaving(-5)).toBeNull()
    expect(trimSaving(100, 0)).toBeNull()
    expect(trimSaving(100, 1)).toBeNull()
  })
})
