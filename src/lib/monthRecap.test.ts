import { describe, expect, it } from 'vitest'
import { buildMonthRecap } from './monthRecap'
import type { Transaction } from './types'

const tx = (date: string, amount: number, category: string, description = category): Transaction => ({ id: date + amount + category + description, date, amount, description, category, mode: 'personal' } as Transaction)

describe('buildMonthRecap', () => {
  it('returns null when the last complete month has no transactions (this month only does not count)', () => {
    expect(buildMonthRecap([], '2026-11-23')).toBeNull()
    expect(buildMonthRecap([tx('2026-11-05', -20, 'Food')], '2026-11-23')).toBeNull()
  })

  it('recaps the previous calendar month with checkable totals', () => {
    const t = [
      tx('2026-10-02', -100, 'Groceries', 'Pak n Save'),
      tx('2026-10-02', -50, 'Fuel'),
      tx('2026-10-15', -300, 'Rent', 'Rent'),
      tx('2026-10-20', -50, 'Groceries'),
      tx('2026-10-31', 1000, 'Income', 'Pay'),
      tx('2026-09-10', -200, 'Groceries'),
      tx('2026-11-01', -999, 'Fuel'), // this month: ignored
    ]
    const r = buildMonthRecap(t, '2026-11-23')!
    expect(r.monthLabel).toBe('October 2026')
    expect(r.spent).toBe(500)
    expect(r.income).toBe(1000)
    expect(r.net).toBe(500)
    expect(r.vsPrevious).toBe(300) // 500 - 200
    expect(r.topCategories.map((c) => c.category)).toEqual(['Rent', 'Groceries', 'Fuel'])
    expect(r.topCategories[0]).toMatchObject({ amount: 300, share: 0.6 })
    expect(r.busiestDay).toEqual({ date: '2026-10-15', amount: 300 })
    expect(r.biggestExpense).toMatchObject({ description: 'Rent', amount: 300 })
    expect(r.daysInMonth).toBe(31)
    expect(r.noSpendDays).toBe(28) // spent on 3 distinct days: 2nd, 15th, 20th
  })

  it('handles the January -> December year boundary and a month with no spending before it', () => {
    const r = buildMonthRecap([tx('2026-12-24', -80, 'Gifts')], '2027-01-05')!
    expect(r.monthLabel).toBe('December 2026')
    expect(r.vsPrevious).toBeNull()
    expect(r.noSpendDays).toBe(30)
  })

  it('never names the uncategorised bucket as a top category', () => {
    const r = buildMonthRecap([tx('2026-10-03', -70, 'uncategorised'), tx('2026-10-04', -5, 'Food')], '2026-11-02')!
    expect(r.topCategories.map((c) => c.category)).toEqual(['Food'])
  })
})
