import { describe, expect, it } from 'vitest'
import { DEFAULT_STATE } from './store'
import { computeSafeToSpend, TIGHT_DAILY_DOLLARS } from './safeToSpend'
import { computeLiveFunds } from './liveFunds'

const TODAY = '2026-11-21' // payday anchor Fri 2026-11-13, weekly: next payday Fri 2026-11-27, 6 days away
const acct = (id: string, value: number) => ({ id, name: id, type: 'liquid', value, countsTowardLiveFunds: true }) as never
const base = (over: Record<string, unknown> = {}) => ({
  ...DEFAULT_STATE,
  accounts: [acct('hsbc', 1000), acct('overdraft', 0)],
  bills: [], periodicBills: [], sinkingFunds: [], savingsGoals: [],
  incomeAnchor: { anchorDate: '2026-11-13', weeklyAmount: 800, fortnightlyBonusAmount: 0 },
  spendTracker: { ...DEFAULT_STATE.spendTracker, food: 0, fuel: 0, personal: 0 },
  householdView: 'deep',
  ...over,
}) as typeof DEFAULT_STATE
const bill = (o: Record<string, unknown>) => ({ id: 'b', name: 'Rent', amount: 400, frequency: 'monthly', dueDay: 23, dueDayIsEstimate: false, category: 'housing', active: true, owner: 'deep', ...o }) as never
const ids = (s: ReturnType<typeof computeSafeToSpend>) => s.warnings.map((w) => w.id)

describe('safe to spend', () => {
  it('counts days to the next payday and splits free-to-spend across them', () => {
    const s = base(); const r = computeSafeToSpend(s, TODAY, 'deep')
    expect(r.daysToPayday).toBe(6)
    expect(r.dailyAllowance).toBe(Math.round((computeLiveFunds(s, TODAY, 'week', 'deep').liveFundsAvailable / 6) * 100) / 100)
    expect(r.warnings).toEqual([])
  })
  it('overspent: Live Funds below zero is critical and names the amount', () => {
    const r = computeSafeToSpend(base({ spendTracker: { ...DEFAULT_STATE.spendTracker, food: 1500, fuel: 0, personal: 1500 } }), TODAY, 'deep')
    expect(ids(r)).toContain('overspent')
    expect(r.warnings.find((w) => w.id === 'overspent')!.severity).toBe('critical')
    expect(r.dailyAllowance).toBe(0)
  })
  it('bill before payday bigger than cash in the accounts is critical', () => {
    const r = computeSafeToSpend(base({ accounts: [acct('hsbc', 100), acct('overdraft', 0)], bills: [bill({ amount: 400, dueDay: 23 })] }), TODAY, 'deep')
    expect(ids(r)).toContain('bill-before-payday')
    expect(r.warnings.find((w) => w.id === 'bill-before-payday')!.message).toContain('Rent in 2 days')
  })
  it('a bill due after payday is not flagged by that rule', () => {
    const r = computeSafeToSpend(base({ accounts: [acct('hsbc', 100), acct('overdraft', 0)], bills: [bill({ dueDay: 28 })] }), TODAY, 'deep')
    expect(ids(r)).not.toContain('bill-before-payday')
  })
  it('a bill the accounts can cover is not flagged', () => {
    expect(ids(computeSafeToSpend(base({ bills: [bill({ amount: 400, dueDay: 23 })] }), TODAY, 'deep'))).not.toContain('bill-before-payday')
  })
  it('tight: positive but under the daily threshold', () => {
    const s = base({ accounts: [acct('hsbc', 5), acct('overdraft', 0)], incomeAnchor: { anchorDate: '2026-11-13', weeklyAmount: 0, fortnightlyBonusAmount: 0 } })
    const r = computeSafeToSpend(s, TODAY, 'deep')
    expect(r.dailyAllowance).toBeLessThan(TIGHT_DAILY_DOLLARS)
    expect(ids(r)).toEqual(['tight-daily'])
  })
  it('an inactive bill is ignored, and Mimi\'s view ignores Deep-only bills', () => {
    const accounts = [acct('hsbc', 100), acct('overdraft', 0)]
    expect(ids(computeSafeToSpend(base({ accounts, bills: [bill({ active: false })] }), TODAY, 'deep'))).not.toContain('bill-before-payday')
    expect(ids(computeSafeToSpend(base({ accounts, bills: [bill({ owner: 'deep' })], householdView: 'mimi' }), TODAY, 'mimi'))).not.toContain('bill-before-payday')
  })
  it('in Mimi view there are no paydays, so it spreads over 7 days', () => {
    expect(computeSafeToSpend(base({ householdView: 'mimi' }), TODAY, 'mimi').daysToPayday).toBe(7)
  })
})
