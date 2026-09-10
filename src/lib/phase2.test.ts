import { describe, it, expect } from 'vitest'
import {
  calcNetWorth, upsertNetWorthSnapshot, projectBalanceSeries, calcFinancialHealthScore, emergencyFundMonths,
  planPayoffWithExtra, totalBillsForHousehold, totalCardBalanceForHousehold, suggestedFortnightlyForSinkingFund,
  totalSinkingFundsSmoothedInWindow, calcSpendPaceAlerts, calcRoundUpSavings, isBillAmountChanged, applyBillAmountChange,
  updateStreak,
} from './logic'
import type { Account, CreditCardAccount, RecurringBill, InstallmentPlan, SinkingFund, SpendTracker, StreakState, Transaction, OneOffEntry } from './types'

describe('Net worth (Phase 1)', () => {
  const accounts: Account[] = [
    { id: 'hsbc', name: 'HSBC', type: 'liquid', value: 1000, countsTowardLiveFunds: true },
    { id: 'savings', name: 'Savings', type: 'liquid', value: 5000, countsTowardLiveFunds: false },
    { id: 'asset-car', name: 'Car', type: 'asset', value: 8000, countsTowardLiveFunds: false },
  ]
  const cards: CreditCardAccount[] = [
    { id: 'c1', name: 'Card', balance: 3000, availableToSpend: 500, minPayment: 100, rates: { purchase: 0.2, cashAdvance: 0.2, interestFreePlan: 0, expiredPlanRate: 0.3 }, plans: [], owner: 'deep' },
  ]

  it('net worth = sum(accounts) - sum(card balances + debts)', () => {
    const result = calcNetWorth(accounts, cards, [{ id: 'd1', name: 'Loan', balance: 2000, apr: 0.1, minPayment: 50 }])
    expect(result.totalAssets).toBe(1000 + 5000 + 8000)
    expect(result.totalLiabilities).toBe(3000 + 2000)
    expect(result.netWorth).toBe(14000 - 5000)
  })

  it('upsertNetWorthSnapshot keeps at most one entry per day', () => {
    let history = upsertNetWorthSnapshot([], { date: '2026-09-10', netWorth: 100, totalAssets: 100, totalLiabilities: 0 })
    history = upsertNetWorthSnapshot(history, { date: '2026-09-10', netWorth: 150, totalAssets: 150, totalLiabilities: 0 })
    expect(history.length).toBe(1)
    expect(history[0].netWorth).toBe(150)
    history = upsertNetWorthSnapshot(history, { date: '2026-09-11', netWorth: 200, totalAssets: 200, totalLiabilities: 0 })
    expect(history.length).toBe(2)
  })
})

describe('Forward cash-flow projection (Phase 2.1)', () => {
  const bills: RecurringBill[] = [
    { id: 'b1', name: 'Rent', amount: 1000, frequency: 'monthly', dueDay: 15, dueDayIsEstimate: false, category: 'housing', active: true, owner: 'shared' },
  ]
  it('a monthly bill fires exactly on its due-day and nowhere else', () => {
    const series = projectBalanceSeries(1000, '2026-09-01', 20, bills, [], [])
    const beforeDue = series.find((p) => p.date === '2026-09-14')!
    const onDue = series.find((p) => p.date === '2026-09-15')!
    const afterDue = series.find((p) => p.date === '2026-09-16')!
    expect(onDue.balance).toBeCloseTo(beforeDue.balance - 1000, 2)
    expect(afterDue.balance).toBe(onDue.balance) // no income/bills that day in this fixture
  })

  it('matches 3 hand-computed future dates: payday Fridays add income, the 15th subtracts rent', () => {
    // Anchor Friday is 2026-09-11 (combined, $1,100); 2026-09-18 weekly-only ($600).
    const series = projectBalanceSeries(0, '2026-09-10', 10, bills, [], [])
    const d11 = series.find((p) => p.date === '2026-09-11')!
    const d15 = series.find((p) => p.date === '2026-09-15')!
    const d18 = series.find((p) => p.date === '2026-09-18')!
    expect(d11.balance).toBe(1100) // just the combined payday, no bill yet
    expect(d15.balance).toBe(1100 - 1000) // rent hits
    expect(d18.balance).toBe(1100 - 1000 + 600) // weekly-only payday
  })

  it('one-off entries land on their exact date', () => {
    const oneOff: OneOffEntry[] = [{ id: 'o1', date: '2026-09-05', description: 'Bonus', amount: 200 }]
    const series = projectBalanceSeries(0, '2026-09-01', 10, [], [], oneOff)
    const before = series.find((p) => p.date === '2026-09-04')!
    const on = series.find((p) => p.date === '2026-09-05')!
    expect(on.balance).toBeCloseTo(before.balance + 200, 2)
  })
})

describe('Financial health score (Phase 2.4) — 3 hand-computed scenarios', () => {
  it('healthy scenario scores high', () => {
    // 25% savings rate (>20% cap -> full), 0.2x debt-to-income (mostly full), 1.8x bill coverage, 5mo emergency fund
    const result = calcFinancialHealthScore({ savingsRate: 0.25, debtToIncome: 0.2, billCoverageRatio: 1.8, emergencyFundMonths: 5 })
    const expectedSavings = 100
    const expectedDebt = (1 - 0.2 / 1.0) * 100 // 80
    const expectedCoverage = ((1.8 - 1) / 1) * 100 // 80
    const expectedEf = (5 / 6) * 100 // 83.33
    const expected = Math.round(expectedSavings * 0.30 + expectedDebt * 0.25 + expectedCoverage * 0.25 + expectedEf * 0.20)
    expect(result.score).toBe(expected)
    expect(result.score).toBeGreaterThan(80)
  })

  it('tight scenario scores mid-range', () => {
    // 5% savings rate, 0.6x debt-to-income, 1.1x coverage, 1 month emergency fund
    const result = calcFinancialHealthScore({ savingsRate: 0.05, debtToIncome: 0.6, billCoverageRatio: 1.1, emergencyFundMonths: 1 })
    const expectedSavings = (0.05 / 0.20) * 100 // 25
    const expectedDebt = (1 - 0.6) * 100 // 40
    const expectedCoverage = ((1.1 - 1) / 1) * 100 // 10
    const expectedEf = (1 / 6) * 100 // 16.67
    const expected = Math.round(expectedSavings * 0.30 + expectedDebt * 0.25 + expectedCoverage * 0.25 + expectedEf * 0.20)
    expect(result.score).toBe(expected)
    expect(result.score).toBeGreaterThan(20)
    expect(result.score).toBeLessThan(60)
  })

  it('overextended scenario scores low', () => {
    // Negative savings rate, debt >= annual income, barely covering bills, no emergency fund
    const result = calcFinancialHealthScore({ savingsRate: -0.10, debtToIncome: 1.2, billCoverageRatio: 0.95, emergencyFundMonths: 0 })
    expect(result.breakdown.savingsRate).toBe(0) // clamped at 0, negative rate
    expect(result.breakdown.debtToIncome).toBe(0) // clamped, debt exceeds income
    expect(result.breakdown.billCoverage).toBe(0) // clamped, under 1.0 ratio
    expect(result.breakdown.emergencyFund).toBe(0)
    expect(result.score).toBe(0)
  })

  it('score is always clamped to [0, 100]', () => {
    const perfect = calcFinancialHealthScore({ savingsRate: 1, debtToIncome: 0, billCoverageRatio: 10, emergencyFundMonths: 100 })
    expect(perfect.score).toBe(100)
  })
})

describe('Emergency fund coverage (Phase 2.7)', () => {
  it('savings ÷ avg monthly bills', () => {
    expect(emergencyFundMonths(3000, 1500)).toBe(2)
  })
  it('zero bills never divides by zero', () => {
    expect(emergencyFundMonths(3000, 0)).toBe(0)
  })
})

describe('What-if extra-payment slider (Phase 2.6)', () => {
  it('interest-free active plan: extra payment reduces months exactly by arithmetic (hand-computed)', () => {
    const plan: InstallmentPlan = { id: 'p1', name: 'Test', total: 1200, remaining: 1200, monthsTotal: 6, monthsRemaining: 6, expired: false }
    // requiredMonthly = 1200/6 = 200. +100 extra = 300/mo. months = ceil(1200/300) = 4.
    const result = planPayoffWithExtra(plan, 100)
    expect(result.months).toBe(4)
    expect(result.totalInterest).toBe(0)
  })
  it('zero extra matches the baseline required-monthly schedule', () => {
    const plan: InstallmentPlan = { id: 'p2', name: 'Test', total: 1000, remaining: 1000, monthsTotal: 5, monthsRemaining: 5, expired: false }
    const result = planPayoffWithExtra(plan, 0)
    expect(result.months).toBe(5)
  })
  it('expired plan: more extra payment never increases months or total interest (monotonic)', () => {
    const plan: InstallmentPlan = { id: 'p3', name: 'Test', total: 500, remaining: 500, monthsTotal: 0, monthsRemaining: 0, expired: true }
    const low = planPayoffWithExtra(plan, 0, 0.2999)
    const high = planPayoffWithExtra(plan, 100, 0.2999)
    expect(high.months).toBeLessThanOrEqual(low.months)
    expect(high.totalInterest).toBeLessThanOrEqual(low.totalInterest)
    expect(low.months).toBeGreaterThan(0)
  })
})

describe('Household Deep/Mimi/Combined split (Phase 2.8) — combined === deep + mimi exactly', () => {
  const bills: RecurringBill[] = [
    { id: 'b1', name: 'Rent', amount: 1000, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'housing', active: true, owner: 'shared', sharedSplitDeepPercent: 60 },
    { id: 'b2', name: 'GEM VISA Deep', amount: 300, frequency: 'monthly', dueDay: 17, dueDayIsEstimate: false, category: 'debt', active: true, owner: 'deep' },
    { id: 'b3', name: 'GEM VISA Mimi', amount: 0, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'debt', active: true, owner: 'mimi' },
  ]
  it('deep-view + mimi-view totals sum to combined-view total exactly', () => {
    const deepTotal = totalBillsForHousehold(bills, 'deep')
    const mimiTotal = totalBillsForHousehold(bills, 'mimi')
    const combinedTotal = totalBillsForHousehold(bills, 'combined')
    expect(deepTotal + mimiTotal).toBeCloseTo(combinedTotal, 2)
  })
  it('the shared bill splits 60/40 as configured', () => {
    expect(totalBillsForHousehold([bills[0]], 'deep')).toBeCloseTo(600, 2)
    expect(totalBillsForHousehold([bills[0]], 'mimi')).toBeCloseTo(400, 2)
  })
  it('a card balance owned solely by one person contributes nothing to the other person\'s view', () => {
    const cards: CreditCardAccount[] = [
      { id: 'c1', name: 'GEM VISA Deep', balance: 9900, availableToSpend: 0, minPayment: 0, rates: { purchase: 0, cashAdvance: 0, interestFreePlan: 0, expiredPlanRate: 0 }, plans: [], owner: 'deep' },
    ]
    expect(totalCardBalanceForHousehold(cards, 'deep')).toBe(9900)
    expect(totalCardBalanceForHousehold(cards, 'mimi')).toBe(0)
    expect(totalCardBalanceForHousehold(cards, 'combined')).toBe(9900)
  })
})

describe('Generalised sinking funds (Phase 2.9) — same math as periodic-bill smoothing', () => {
  it('a car WOF/rego fund smooths correctly', () => {
    const fund: SinkingFund = { id: 'f1', name: 'Car WOF', targetAmount: 700, targetDate: '2026-10-08', currentSaved: 0 }
    const today = '2026-09-10'
    // 28 days remaining -> 2 fortnights -> 350/fortnight
    const result = suggestedFortnightlyForSinkingFund(fund, today)
    expect(result).toBeCloseTo(700 / 2, 1)
  })
  it('current savings reduce the suggested amount', () => {
    const fund: SinkingFund = { id: 'f2', name: 'Christmas', targetAmount: 1000, targetDate: '2026-10-08', currentSaved: 300 }
    const result = suggestedFortnightlyForSinkingFund(fund, '2026-09-10')
    expect(result).toBeCloseTo(700 / 2, 1)
  })
  it('totalSinkingFundsSmoothedInWindow prorates like a fortnightly cost', () => {
    const fund: SinkingFund = { id: 'f3', name: 'Test', targetAmount: 700, targetDate: '2026-10-08', currentSaved: 0 }
    const total = totalSinkingFundsSmoothedInWindow([fund], '2026-09-10', '2026-09-16', '2026-09-10')
    expect(total).toBeCloseTo((700 / 2) * (7 / 14), 1)
  })
})

describe('Predictive spend-pace alert (Phase 2.11)', () => {
  it('flags a category outrunning elapsed-time pace by more than the buffer', () => {
    const tracker: SpendTracker = { food: 80, fuel: 10, personal: 10, periodStart: '2026-09-10' }
    const allocation = { food: 100, fuel: 100, personal: 100 }
    // window 2026-09-10..2026-09-16 (7 days), today 2026-09-12 -> elapsed 3/7 = 42.8%. food spent 80% -> flags (80-42.8=37.2 > 10 buffer)
    const alerts = calcSpendPaceAlerts(tracker, allocation, '2026-09-10', '2026-09-16', '2026-09-12')
    expect(alerts.some((a) => a.category === 'food')).toBe(true)
    expect(alerts.some((a) => a.category === 'fuel')).toBe(false)
  })
  it('does not flag when spend pace roughly tracks elapsed-time pace', () => {
    const tracker: SpendTracker = { food: 40, fuel: 40, personal: 40, periodStart: '2026-09-10' }
    const allocation = { food: 100, fuel: 100, personal: 100 }
    const alerts = calcSpendPaceAlerts(tracker, allocation, '2026-09-10', '2026-09-16', '2026-09-12')
    expect(alerts.length).toBe(0)
  })
})

describe('Round-up savings simulator (Phase 2.12)', () => {
  it('rounds each expense up to the nearest $5 and sums the difference', () => {
    const txs: Transaction[] = [
      { id: 't1', date: '2026-09-01', description: 'Coffee', amount: -4.2, category: 'food', mode: 'personal' },
      { id: 't2', date: '2026-09-02', description: 'Fuel', amount: -32.5, category: 'fuel', mode: 'personal' },
      { id: 't3', date: '2026-09-03', description: 'Pay', amount: 600, category: 'income', mode: 'personal' }, // income ignored
    ]
    // Coffee: ceil(4.2/5)*5=5, diff 0.8. Fuel: ceil(32.5/5)*5=35, diff 2.5. Total 3.3.
    expect(calcRoundUpSavings(txs, 5)).toBeCloseTo(3.3, 2)
  })
})

describe('Bill price-increase detection (Phase 2.5)', () => {
  it('flags when the amount genuinely changed since last saved', () => {
    const bill: RecurringBill = { id: 'b1', name: 'Gas', amount: 200, previousAmount: 150, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'utilities', active: true, owner: 'shared' }
    expect(isBillAmountChanged(bill)).toBe(true)
  })
  it('does not flag when the amount is unchanged (or never edited)', () => {
    const bill: RecurringBill = { id: 'b2', name: 'Gas', amount: 200, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'utilities', active: true, owner: 'shared' }
    expect(isBillAmountChanged(bill)).toBe(false)
    const unchanged: RecurringBill = { ...bill, previousAmount: 200 }
    expect(isBillAmountChanged(unchanged)).toBe(false)
  })
  it('applyBillAmountChange remembers the old value only when the amount actually changes', () => {
    const bill: RecurringBill = { id: 'b3', name: 'Water', amount: 50, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'utilities', active: true, owner: 'shared' }
    expect(applyBillAmountChange(bill, 50)).toEqual({})
    expect(applyBillAmountChange(bill, 60)).toEqual({ amount: 60, previousAmount: 50 })
  })
})

describe('Savings streaks (Phase 2.17)', () => {
  it('increments the streak once per day when staying on pace, and only checks once per real day', () => {
    let streak: StreakState = { current: 3, best: 5, lastCheckedDate: '2026-09-09', milestonesHit: [] }
    const first = updateStreak(streak, true, '2026-09-10')
    expect(first.streak.current).toBe(4)
    expect(first.streak.best).toBe(5)
    const second = updateStreak(first.streak, true, '2026-09-10') // same day again — no-op
    expect(second.streak.current).toBe(4)
  })
  it('resets to 0 when pace is exceeded, and fires a milestone exactly once', () => {
    let streak: StreakState = { current: 6, best: 6, lastCheckedDate: '2026-09-09', milestonesHit: [] }
    const hit7 = updateStreak(streak, true, '2026-09-10')
    expect(hit7.streak.current).toBe(7)
    expect(hit7.newMilestone).toBe(7)
    const hitAgainNextDay = updateStreak(hit7.streak, false, '2026-09-11')
    expect(hitAgainNextDay.streak.current).toBe(0)
    expect(hitAgainNextDay.streak.milestonesHit).toEqual([])
  })
})
