import { describe, expect, it } from 'vitest'
import { runExtraHealthChecks } from './dataHealthExtra'
import type { Account, IncomeAnchor, OneOffEntry, RecurringBill, SavingsGoal, SinkingFund } from './types'

const TODAY = '2026-11-21'
const bill = (o: Partial<RecurringBill>): RecurringBill => ({ id: 'b', name: 'Power', amount: 100, frequency: 'monthly', dueDay: 15, dueDayIsEstimate: false, category: 'utilities', active: true, ...o } as RecurringBill)
const acct = (o: Partial<Account>): Account => ({ id: 'a', name: 'HSBC', type: 'liquid', value: 100, countsTowardLiveFunds: true, ...o } as Account)
const goal = (o: Partial<SavingsGoal>): SavingsGoal => ({ id: 'g', name: 'Holiday', targetAmount: 1000, contributedAmount: 200, fundedThisPeriod: 0, ...o } as SavingsGoal)
const fund = (o: Partial<SinkingFund>): SinkingFund => ({ id: 'f', name: 'Rego', targetAmount: 500, targetDate: '2027-03-01', currentSaved: 100, ...o })
const anchor: IncomeAnchor = { anchorDate: '2026-11-13', weeklyAmount: 900, fortnightlyBonusAmount: 100 }
const run = (o: Partial<Parameters<typeof runExtraHealthChecks>[0]> = {}) =>
  runExtraHealthChecks({ today: TODAY, bills: [], accounts: [], creditCards: [], savingsGoals: [], sinkingFunds: [], oneOffEntries: [], incomeAnchor: anchor, ...o })
const ids = (f: { id: string }[]) => f.map((x) => x.id)

describe('extra data health checks', () => {
  it('finds nothing wrong in healthy data', () => {
    expect(run({ bills: [bill({})], accounts: [acct({})], savingsGoals: [goal({})], sinkingFunds: [fund({})] })).toEqual([])
  })
  it('bills: a bad due day and a negative active bill', () => {
    const f = run({ bills: [bill({ id: 'x', dueDay: 35 }), bill({ id: 'y', dueDay: 0 }), bill({ id: 'z', amount: -20 }), bill({ id: 'w', amount: -20, active: false })] })
    expect(ids(f).sort()).toEqual(['dueday-x', 'dueday-y', 'negbill-z'])
  })
  it('accounts with the same name are flagged once', () => {
    expect(ids(run({ accounts: [acct({ id: '1', name: 'HSBC' }), acct({ id: '2', name: ' hsbc ' }), acct({ id: '3', name: 'Savings' })] }))).toEqual(['dupacct-hsbc'])
  })
  it('savings goals: no target, over target, past its date and still short, bad date', () => {
    const f = run({ savingsGoals: [goal({ id: '1', targetAmount: 0 }), goal({ id: '2', contributedAmount: 1500 }), goal({ id: '3', targetDate: '2026-10-01', contributedAmount: 300 }), goal({ id: '4', targetDate: '2026-31-31' }), goal({ id: '5', targetDate: '2026-10-01', contributedAmount: 1000 })] })
    expect(ids(f).sort()).toEqual(['goalbaddate-4', 'goaldate-3', 'goalover-2', 'goalzero-1'])
    expect(f.find((x) => x.id === 'goaldate-3')!.message).toContain('$700.00 short')
  })
  it('funds: past due and short, over-funded, no target, bad date', () => {
    const f = run({ sinkingFunds: [fund({ id: '1', targetDate: '2026-10-01' }), fund({ id: '2', currentSaved: 600 }), fund({ id: '3', targetAmount: 0 }), fund({ id: '4', targetDate: 'soon' })] })
    expect(ids(f).sort()).toEqual(['fundbaddate-4', 'funddate-1', 'fundover-2', 'fundzero-3'])
  })
  it('income anchor: zero pay and a bad date', () => {
    expect(ids(run({ incomeAnchor: { anchorDate: 'tomorrow', weeklyAmount: 0, fortnightlyBonusAmount: 0 } })).sort()).toEqual(['income-date', 'income-weekly'])
  })
  it('one-off entries: far future (likely a typo), a bad date, $0', () => {
    const e = (o: Partial<OneOffEntry>): OneOffEntry => ({ id: 'e', date: '2026-12-01', description: 'Gift', amount: -50, ...o })
    const f = run({ oneOffEntries: [e({ id: '1', date: '2028-01-01' }), e({ id: '2', date: '2026-02-30x' }), e({ id: '3', amount: 0 }), e({ id: '4', date: '2027-11-01' })] })
    expect(ids(f).sort()).toEqual(['oneoff-bad-2', 'oneoff-far-1', 'oneoff-zero-3'])
  })
})
