import { describe, it, expect } from 'vitest'
import { buildInsightsTicker, buildDashboardHeadline, applyBillAmountChange, dueDateSeverity, dueInLabel } from './logic'
import type { RecurringBill, PeriodicBill, SinkingFund, StreakState } from './types'

describe('buildInsightsTicker — real rotating content from the actual data model', () => {
  const bills: RecurringBill[] = [
    { id: 'b1', name: 'Rent', amount: 1960, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'housing', active: true, owner: 'shared' },
  ]
  const periodicBills: PeriodicBill[] = [
    {
      id: 'p1', name: 'Gas', pendingBill: { amount: 300.27, dueDate: '2026-09-17', periodStart: '2026-07-04', periodEnd: '2026-08-28' },
      gaugePeriodStart: '2026-08-29', gaugePeriodEnd: '2026-10-28', projectedCharge: 369.18, inCredit: false, creditAmount: 0, smoothingEnabled: true, owner: 'shared',
    },
  ]
  const sinkingFunds: SinkingFund[] = []
  const streak: StreakState = { current: 5, best: 10, lastCheckedDate: '2026-09-10', milestonesHit: [] }

  it('surfaces the real nearest due date, computed from today, not hardcoded, tagged as a bill-type item', () => {
    const items = buildInsightsTicker({ bills, periodicBills, sinkingFunds, healthScoreHistory: [], streak, todayIso: '2026-09-10' })
    const gasItem = items.find((m) => m.text.includes('Gas due'))
    expect(gasItem).toBeDefined()
    expect(gasItem!.type).toBe('bill')
    // Gas is due 2026-09-17, 7 days after today (2026-09-10) — within the amber window (<=5 fails, so this is genuinely 'ok').
    expect(gasItem!.severity).toBe('ok')
  })

  it('reports a real health-score delta only when there are 2+ real days of history, tagged as a health-type item', () => {
    const withHistory = buildInsightsTicker({
      bills: [], periodicBills: [], sinkingFunds: [], streak: { current: 0, best: 0, lastCheckedDate: '', milestonesHit: [] },
      healthScoreHistory: [{ date: '2026-09-09', score: 60 }, { date: '2026-09-10', score: 64 }],
      todayIso: '2026-09-10',
    })
    const healthItem = withHistory.find((m) => m.text === 'Health score up 4 points since yesterday')
    expect(healthItem).toBeDefined()
    expect(healthItem!.type).toBe('health')

    const withoutHistory = buildInsightsTicker({
      bills: [], periodicBills: [], sinkingFunds: [], streak: { current: 0, best: 0, lastCheckedDate: '', milestonesHit: [] },
      healthScoreHistory: [{ date: '2026-09-10', score: 64 }],
      todayIso: '2026-09-10',
    })
    expect(withoutHistory.some((m) => m.text.includes('Health score'))).toBe(false)
  })

  it('includes the real streak count when active, tagged as a streak-type item', () => {
    const items = buildInsightsTicker({ bills: [], periodicBills: [], sinkingFunds: [], healthScoreHistory: [], streak, todayIso: '2026-09-10' })
    const streakItem = items.find((m) => m.text === '5-day streak — staying on pace')
    expect(streakItem).toBeDefined()
    expect(streakItem!.type).toBe('streak')
  })

  it('flags a real price change, using the actual old/new amounts, tagged as a price-type item', () => {
    const changed: RecurringBill = { ...bills[0], previousAmount: 1800 }
    const items = buildInsightsTicker({ bills: [changed], periodicBills: [], sinkingFunds: [], healthScoreHistory: [], streak: { current: 0, best: 0, lastCheckedDate: '', milestonesHit: [] }, todayIso: '2026-09-10' })
    const priceItem = items.find((m) => m.text === 'Rent changed from $1800.00 to $1960.00')
    expect(priceItem).toBeDefined()
    expect(priceItem!.type).toBe('price')
  })

  it('falls back to an honest default when there is genuinely nothing to say', () => {
    const items = buildInsightsTicker({ bills: [], periodicBills: [], sinkingFunds: [], healthScoreHistory: [], streak: { current: 0, best: 0, lastCheckedDate: '', milestonesHit: [] }, todayIso: '2026-09-10' })
    expect(items).toEqual([{ type: 'default', text: 'All bills on track — nothing urgent right now' }])
  })
})

describe('dueDateSeverity / dueInLabel — the shared traffic-light system every due-date UI element reuses', () => {
  it('is danger when overdue or within the danger window (<=2 days)', () => {
    expect(dueDateSeverity(-1)).toBe('danger')
    expect(dueDateSeverity(0)).toBe('danger')
    expect(dueDateSeverity(2)).toBe('danger')
  })

  it('is warn between the danger and warn windows (3-5 days)', () => {
    expect(dueDateSeverity(3)).toBe('warn')
    expect(dueDateSeverity(5)).toBe('warn')
  })

  it('is ok comfortably beyond the warn window (6+ days)', () => {
    expect(dueDateSeverity(6)).toBe('ok')
    expect(dueDateSeverity(30)).toBe('ok')
  })

  it('labels overdue, today, tomorrow, and future days correctly', () => {
    expect(dueInLabel(-3)).toBe('3 days overdue')
    expect(dueInLabel(-1)).toBe('1 day overdue')
    expect(dueInLabel(0)).toBe('due today')
    expect(dueInLabel(1)).toBe('due tomorrow')
    expect(dueInLabel(4)).toBe('due in 4 days')
  })
})

describe('buildDashboardHeadline — plain-language sentence computed from real numbers', () => {
  const breakdown = { savingsRate: 100, debtToIncome: 80, billCoverage: 20, emergencyFund: 0 }

  it('names emergency fund as the weakest area when its sub-score is lowest', () => {
    const headline = buildDashboardHeadline(500, 70, breakdown)
    expect(headline).toContain('$500.00 ahead')
    expect(headline).toContain('your emergency fund')
  })

  it('flips to a "behind" framing when leftover is negative, still naming the real weakest area', () => {
    const headline = buildDashboardHeadline(-200, 40, breakdown)
    expect(headline).toContain('behind')
    expect(headline).toContain('$200.00')
    expect(headline).toContain('mergency fund')
  })
})

describe('applyBillAmountChange sanity (already covered elsewhere, re-checked alongside the new ticker test using it)', () => {
  it('is a no-op when the amount does not change', () => {
    const bill: RecurringBill = { id: 'x', name: 'x', amount: 10, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'other', active: true, owner: 'shared' }
    expect(applyBillAmountChange(bill, 10)).toEqual({})
  })
})
