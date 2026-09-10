import { describe, it, expect } from 'vitest'
import { incomeOnDate, isCombinedPayday, isPayday, totalIncomeInWindow, totalBillsInWindow } from './logic'
import type { RecurringBill } from './types'

describe('payday logic — real date math from the 2026-09-11 anchor, not a lookup table', () => {
  it('2026-09-11 (anchor) is a combined $1,100 payday', () => {
    expect(incomeOnDate('2026-09-11')).toBe(1100)
    expect(isCombinedPayday('2026-09-11')).toBe(true)
  })
  it('2026-09-18 (one week later) is a weekly-only $600 payday', () => {
    expect(incomeOnDate('2026-09-18')).toBe(600)
    expect(isCombinedPayday('2026-09-18')).toBe(false)
    expect(isPayday('2026-09-18')).toBe(true)
  })
  it('2026-09-25 (two weeks later) is a combined $1,100 payday again', () => {
    expect(incomeOnDate('2026-09-25')).toBe(1100)
    expect(isCombinedPayday('2026-09-25')).toBe(true)
  })
  it('the alternating pattern continues correctly into October', () => {
    expect(incomeOnDate('2026-10-02')).toBe(600) // weekly-only
    expect(incomeOnDate('2026-10-09')).toBe(1100) // combined
    expect(incomeOnDate('2026-10-16')).toBe(600)
    expect(incomeOnDate('2026-10-23')).toBe(1100)
  })
  it('the pattern is correct going BACKWARDS before the anchor too', () => {
    expect(incomeOnDate('2026-09-04')).toBe(600) // one week before anchor: weekly-only
    expect(incomeOnDate('2026-08-28')).toBe(1100) // two weeks before: combined
  })
  it('non-Friday dates and non-payday-week dates land $0', () => {
    expect(incomeOnDate('2026-09-10')).toBe(0) // Thursday, today
    expect(incomeOnDate('2026-09-12')).toBe(0) // Saturday
  })
  it('totalIncomeInWindow sums correctly over a week window from today', () => {
    // Window: 2026-09-10 (Thu) to 2026-09-16 (Wed) inclusive -> only 2026-09-11 lands ($1,100)
    expect(totalIncomeInWindow('2026-09-10', '2026-09-16')).toBe(1100)
  })
  it('totalIncomeInWindow sums correctly over a month window from today', () => {
    // 2026-09-10 to 2026-10-09 inclusive: Fridays 09-11(1100), 09-18(600), 09-25(1100), 10-02(600), 10-09(1100)
    expect(totalIncomeInWindow('2026-09-10', '2026-10-09')).toBe(1100 + 600 + 1100 + 600 + 1100)
  })
})

describe('bill window proration — honest estimate labelling, monthly bills prorated by day count', () => {
  const bills: RecurringBill[] = [
    { id: 'b1', name: 'Rent', amount: 1960, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'housing', active: true, owner: 'shared' },
  ]
  it('a 7-day window gets roughly 7/30.44 of the monthly bill', () => {
    const total = totalBillsInWindow(bills, '2026-09-10', '2026-09-16')
    expect(total).toBeCloseTo(1960 * (7 / 30.44), 2)
  })
  it('a 30-day window gets roughly the full monthly amount', () => {
    const total = totalBillsInWindow(bills, '2026-09-10', '2026-10-09')
    expect(total).toBeCloseTo(1960 * (30 / 30.44), 1)
  })
  it('inactive bills are excluded', () => {
    const inactive: RecurringBill[] = [{ ...bills[0], active: false }]
    expect(totalBillsInWindow(inactive, '2026-09-10', '2026-10-09')).toBe(0)
  })
})
