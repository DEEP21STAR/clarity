import { describe, it, expect } from 'vitest'
import { buildInsightsTicker, buildDashboardHeadline, applyBillAmountChange } from './logic'
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

  it('surfaces the real nearest due date, computed from today, not hardcoded', () => {
    const messages = buildInsightsTicker({ bills, periodicBills, sinkingFunds, healthScoreHistory: [], streak, todayIso: '2026-09-10' })
    expect(messages.some((m) => m.includes('Gas due'))).toBe(true)
  })

  it('reports a real health-score delta only when there are 2+ real days of history', () => {
    const withHistory = buildInsightsTicker({
      bills: [], periodicBills: [], sinkingFunds: [], streak: { current: 0, best: 0, lastCheckedDate: '', milestonesHit: [] },
      healthScoreHistory: [{ date: '2026-09-09', score: 60 }, { date: '2026-09-10', score: 64 }],
      todayIso: '2026-09-10',
    })
    expect(withHistory.some((m) => m === 'Health score up 4 points since yesterday')).toBe(true)

    const withoutHistory = buildInsightsTicker({
      bills: [], periodicBills: [], sinkingFunds: [], streak: { current: 0, best: 0, lastCheckedDate: '', milestonesHit: [] },
      healthScoreHistory: [{ date: '2026-09-10', score: 64 }],
      todayIso: '2026-09-10',
    })
    expect(withoutHistory.some((m) => m.includes('Health score'))).toBe(false)
  })

  it('includes the real streak count when active', () => {
    const messages = buildInsightsTicker({ bills: [], periodicBills: [], sinkingFunds: [], healthScoreHistory: [], streak, todayIso: '2026-09-10' })
    expect(messages.some((m) => m === '5-day streak — staying on pace')).toBe(true)
  })

  it('flags a real price change, using the actual old/new amounts', () => {
    const changed: RecurringBill = { ...bills[0], previousAmount: 1800 }
    const messages = buildInsightsTicker({ bills: [changed], periodicBills: [], sinkingFunds: [], healthScoreHistory: [], streak: { current: 0, best: 0, lastCheckedDate: '', milestonesHit: [] }, todayIso: '2026-09-10' })
    expect(messages.some((m) => m === 'Rent changed from $1800.00 to $1960.00')).toBe(true)
  })

  it('falls back to an honest default when there is genuinely nothing to say', () => {
    const messages = buildInsightsTicker({ bills: [], periodicBills: [], sinkingFunds: [], healthScoreHistory: [], streak: { current: 0, best: 0, lastCheckedDate: '', milestonesHit: [] }, todayIso: '2026-09-10' })
    expect(messages).toEqual(['All bills on track — nothing urgent right now'])
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
