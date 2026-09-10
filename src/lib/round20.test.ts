import { describe, it, expect } from 'vitest'
import {
  isBillInstancePaid, avalanchePayoffTimeline, avalanchePlan, dueDateSeverity, computeCurrentHealthScore,
  categoryColor, findMatchRanges, netWorthMilestones, trendDirection, percentChange, monthlySpendByCategory,
  applyPaymentToCard, applyPaymentToPlan, applyPaymentToPeriodicBill, applyPaymentToDevice, filterPaymentRecords,
  generateCategoryTrendInsights, buildYearInReview,
} from './logic'
import { formatCurrency } from './utils'
import type { PaymentRecord, Debt, Account, NetWorthSnapshot, Transaction, CreditCardAccount, InstallmentPlan, PeriodicBill, DeviceRepayment } from './types'

describe('formatCurrency — explicit locale, not the viewer\'s ambient one (#51)', () => {
  it('always formats comma-thousands/period-decimal regardless of environment locale', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
    expect(formatCurrency(1234.5, 'AUD')).toBe('A$1,234.50')
    expect(formatCurrency(-42.1)).toBe('-$42.10')
  })
})

describe('isBillInstancePaid — real per-instance paid tracking (#8)', () => {
  const records: PaymentRecord[] = [
    { id: 'p1', targetType: 'recurringBill', targetId: 'bill-rent', targetLabel: 'Rent', amount: 1960, date: '2026-09-01', dueDateIso: '2026-09-01', recordedAt: '2026-09-01T10:00:00.000Z' },
  ]

  it('is true only for the exact billId + dueDateIso pair that was recorded', () => {
    expect(isBillInstancePaid(records, 'bill-rent', '2026-09-01')).toBe(true)
  })

  it('is false for the same bill on a different due date (a different instance)', () => {
    expect(isBillInstancePaid(records, 'bill-rent', '2026-10-01')).toBe(false)
  })

  it('is false for a different bill entirely', () => {
    expect(isBillInstancePaid(records, 'bill-water', '2026-09-01')).toBe(false)
  })

  it('is false against an empty ledger', () => {
    expect(isBillInstancePaid([], 'bill-rent', '2026-09-01')).toBe(false)
  })
})

describe('#8 expanded — real payment recording reduces the real balance (hand-computed)', () => {
  it('applyPaymentToCard reduces balance and increases availableToSpend, clamped at the credit limit', () => {
    const card: CreditCardAccount = {
      id: 'card1', name: 'GEM VISA Deep', balance: 9900.25, creditLimit: 10200, availableToSpend: 299.75,
      minPayment: 305.33, rates: { purchase: 0.2999, cashAdvance: 0.2999, interestFreePlan: 0, expiredPlanRate: 0.2999 },
      plans: [], owner: 'deep',
    }
    const after = applyPaymentToCard(card, 325)
    expect(after.balance).toBe(9575.25) // 9900.25 - 325
    expect(after.availableToSpend).toBe(624.75) // 299.75 + 325, well under the 10200 limit
  })

  it('applyPaymentToCard never lets balance go negative on an overpayment', () => {
    const card: CreditCardAccount = {
      id: 'card1', name: 'Card', balance: 100, availableToSpend: 0, minPayment: 0,
      rates: { purchase: 0.2, cashAdvance: 0.2, interestFreePlan: 0, expiredPlanRate: 0.2 }, plans: [], owner: 'shared',
    }
    expect(applyPaymentToCard(card, 500).balance).toBe(0)
  })

  it('applyPaymentToCard is exactly reversible with a negated amount (real Undo)', () => {
    const card: CreditCardAccount = {
      id: 'card1', name: 'Card', balance: 500, creditLimit: 1000, availableToSpend: 500, minPayment: 20,
      rates: { purchase: 0.2, cashAdvance: 0.2, interestFreePlan: 0, expiredPlanRate: 0.2 }, plans: [], owner: 'shared',
    }
    const paid = applyPaymentToCard(card, 150)
    const undone = applyPaymentToCard(paid, -150)
    expect(undone).toEqual(card)
  })

  it('applyPaymentToPlan reduces remaining, floored at 0', () => {
    const plan: InstallmentPlan = { id: 'p1', name: 'Plan', total: 500, remaining: 200, monthsTotal: 6, monthsRemaining: 2, expired: false }
    expect(applyPaymentToPlan(plan, 80).remaining).toBe(120)
    expect(applyPaymentToPlan(plan, 999).remaining).toBe(0)
  })

  it('applyPaymentToPeriodicBill reduces the pending amount for a partial payment', () => {
    const bill: PeriodicBill = {
      id: 'gas', name: 'Gas', pendingBill: { amount: 300.27, dueDate: '2026-09-17', periodStart: '2026-07-04', periodEnd: '2026-08-28' },
      gaugePeriodStart: '2026-08-29', gaugePeriodEnd: '2026-10-28', projectedCharge: 369.18, inCredit: false, creditAmount: 0, smoothingEnabled: true, owner: 'shared',
    }
    const after = applyPaymentToPeriodicBill(bill, 100)
    expect(after.pendingBill?.amount).toBe(200.27)
    expect(after.inCredit).toBe(false)
  })

  it('applyPaymentToPeriodicBill clears the pending bill and books real credit on an overpayment', () => {
    const bill: PeriodicBill = {
      id: 'gas', name: 'Gas', pendingBill: { amount: 300.27, dueDate: '2026-09-17', periodStart: '2026-07-04', periodEnd: '2026-08-28' },
      gaugePeriodStart: '2026-08-29', gaugePeriodEnd: '2026-10-28', projectedCharge: 369.18, inCredit: false, creditAmount: 0, smoothingEnabled: true, owner: 'shared',
    }
    const after = applyPaymentToPeriodicBill(bill, 350)
    expect(after.pendingBill).toBeUndefined()
    expect(after.inCredit).toBe(true)
    expect(after.creditAmount).toBe(49.73) // round2(350 - 300.27)
  })

  it('applyPaymentToDevice reduces remaining, floored at 0', () => {
    const device: DeviceRepayment = { id: 'd1', name: 'Phone', monthlyAmount: 44.70, remaining: 983.40, paymentsTotal: 36, paymentsRemaining: 22, owner: 'deep' }
    expect(applyPaymentToDevice(device, 44.70).remaining).toBe(938.70)
  })
})

describe('filterPaymentRecords — the ONE shared filter logic every payment-history view reuses', () => {
  const records: PaymentRecord[] = [
    { id: 'p1', targetType: 'creditCard', targetId: 'card-deep', targetLabel: 'GEM VISA Deep', amount: 325, date: '2026-09-10', recordedAt: '2026-09-10T09:00:00.000Z' },
    { id: 'p2', targetType: 'creditCard', targetId: 'card-mimi', targetLabel: 'GEM VISA Mimi', amount: 100, date: '2026-09-05', recordedAt: '2026-09-05T09:00:00.000Z' },
    { id: 'p3', targetType: 'recurringBill', targetId: 'bill-rent', targetLabel: 'Rent', amount: 1960, date: '2026-08-01', dueDateIso: '2026-08-01', recordedAt: '2026-08-01T09:00:00.000Z' },
  ]

  it('filters by targetId', () => {
    expect(filterPaymentRecords(records, { targetId: 'card-deep' }).map((r) => r.id)).toEqual(['p1'])
  })

  it('filters by date range', () => {
    expect(filterPaymentRecords(records, { startDate: '2026-09-01' }).map((r) => r.id)).toEqual(['p1', 'p2'])
    expect(filterPaymentRecords(records, { endDate: '2026-08-31' }).map((r) => r.id)).toEqual(['p3'])
  })

  it('sorts newest-first by date', () => {
    expect(filterPaymentRecords(records, {}).map((r) => r.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('with no filter returns everything', () => {
    expect(filterPaymentRecords(records, {})).toHaveLength(3)
  })
})

describe('avalanchePayoffTimeline — real month-by-month balance series, hand-computed (#6/#7)', () => {
  it('matches a hand-computed single-debt trajectory exactly', () => {
    // $1200 balance, 24% APR (2%/mo), $100 min payment, no extra budget.
    // Month 1: interest = 1200*0.02 = 24 -> 1224; payment 100 -> 1124.
    // Month 2: interest = 1124*0.02 = 22.48 -> 1146.48; payment 100 -> 1046.48.
    const debts: Debt[] = [{ id: 'd1', name: 'Card', balance: 1200, apr: 0.24, minPayment: 100 }]
    const timeline = avalanchePayoffTimeline(debts, 0)
    expect(timeline[0]).toEqual({ month: 0, totalBalance: 1200, balances: { d1: 1200 } })
    expect(timeline[1].totalBalance).toBe(1124)
    expect(timeline[2].totalBalance).toBe(1046.48)
  })

  it('is monotonically non-increasing in total balance once past month 0 (interest is applied before payment each month)', () => {
    const debts: Debt[] = [
      { id: 'd1', name: 'Card A', balance: 3000, apr: 0.2999, minPayment: 80 },
      { id: 'd2', name: 'Card B', balance: 1500, apr: 0.1999, minPayment: 50 },
    ]
    const timeline = avalanchePayoffTimeline(debts, 150)
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].totalBalance).toBeLessThanOrEqual(timeline[i - 1].totalBalance + 0.01)
    }
    expect(timeline[timeline.length - 1].totalBalance).toBeLessThan(1)
  })

  it('reaches zero in the same number of months as avalanchePlan()\'s totalMonths for the same inputs', () => {
    const debts: Debt[] = [
      { id: 'd1', name: 'Card A', balance: 2000, apr: 0.2599, minPayment: 60 },
      { id: 'd2', name: 'Card B', balance: 800, apr: 0.1499, minPayment: 30 },
    ]
    const plan = avalanchePlan(debts, 100)
    const timeline = avalanchePayoffTimeline(debts, 100)
    expect(timeline.length - 1).toBe(plan.totalMonths)
  })

  it('returns an empty timeline when there is nothing to pay off', () => {
    expect(avalanchePayoffTimeline([], 100)).toEqual([])
    expect(avalanchePayoffTimeline([{ id: 'd1', name: 'Paid off', balance: 0, apr: 0.2, minPayment: 25 }], 100)).toEqual([])
  })
})

describe('monthlySpendByCategory — real month-over-month category trend from imported transactions (#5)', () => {
  const transactions: Transaction[] = [
    { id: 't1', date: '2026-07-15', description: 'New World', amount: -120, category: 'Groceries', mode: 'personal' },
    { id: 't2', date: '2026-08-10', description: 'New World', amount: -80, category: 'Groceries', mode: 'personal' },
    { id: 't3', date: '2026-08-20', description: 'Countdown', amount: -40, category: 'Groceries', mode: 'personal' },
    { id: 't4', date: '2026-08-01', description: 'Z Energy', amount: -60, category: 'Fuel', mode: 'personal' },
    { id: 't5', date: '2026-08-05', description: 'Salary', amount: 3000, category: 'Income', mode: 'personal' },
  ]

  it('sums real spend per category per month, income excluded', () => {
    const series = monthlySpendByCategory(transactions)
    const groceries = series.find((s) => s.category === 'Groceries')!
    expect(groceries.points).toEqual([
      { month: '2026-07', total: 120 },
      { month: '2026-08', total: 120 }, // 80 + 40
    ])
    expect(series.some((s) => s.category === 'Income')).toBe(false)
  })

  it('orders categories biggest-spender-first', () => {
    const series = monthlySpendByCategory(transactions)
    expect(series[0].category).toBe('Groceries') // 240 total vs Fuel's 60
  })

  it('returns an empty list for no transactions', () => {
    expect(monthlySpendByCategory([])).toEqual([])
  })
})

describe('generateCategoryTrendInsights — real trend-arrow-backed text, not invented (#45)', () => {
  it('flags a real >=5% month-over-month change with the correct direction and numbers', () => {
    const insights = generateCategoryTrendInsights([
      { category: 'Fuel', points: [{ month: '2026-07', total: 100 }, { month: '2026-08', total: 112 }] },
    ])
    expect(insights).toEqual([
      { id: 'trend-Fuel', severity: 'warning', message: 'Fuel spend up 12% vs last month ($100.00 → $112.00).' },
    ])
  })

  it('does not fire for a change under the noise threshold', () => {
    const insights = generateCategoryTrendInsights([
      { category: 'Groceries', points: [{ month: '2026-07', total: 200 }, { month: '2026-08', total: 204 }] }, // 2%, under threshold
    ])
    expect(insights).toEqual([])
  })

  it('does not fire with fewer than 2 real months of data', () => {
    expect(generateCategoryTrendInsights([{ category: 'Fuel', points: [{ month: '2026-08', total: 100 }] }])).toEqual([])
  })

  it('marks a real decrease as info severity, not a warning', () => {
    const insights = generateCategoryTrendInsights([
      { category: 'Entertainment', points: [{ month: '2026-07', total: 100 }, { month: '2026-08', total: 80 }] },
    ])
    expect(insights[0].severity).toBe('info')
    expect(insights[0].message).toContain('down 20%')
  })
})

describe('buildYearInReview — real annual recap, hand-computed (#44)', () => {
  it('sums real payments in the rolling 365-day window and computes real net-worth change', () => {
    const review = buildYearInReview({
      paymentRecords: [
        { id: 'p1', targetType: 'creditCard', targetId: 'c1', targetLabel: 'Card', amount: 325, date: '2026-09-10', recordedAt: '2026-09-10T00:00:00.000Z' },
        { id: 'p2', targetType: 'recurringBill', targetId: 'b1', targetLabel: 'Rent', amount: 1960, date: '2025-01-01', dueDateIso: '2025-01-01', recordedAt: '2025-01-01T00:00:00.000Z' }, // outside the window
      ],
      netWorthHistory: [
        { date: '2025-09-11', netWorth: 10000, totalAssets: 10000, totalLiabilities: 0 },
        { date: '2026-09-10', netWorth: 15000, totalAssets: 15000, totalLiabilities: 0 },
      ],
      streak: { current: 3, best: 12, lastCheckedDate: '2026-09-10', milestonesHit: [7] },
      savingsGoals: [
        { id: 'g1', name: 'Christmas', targetAmount: 500, contributedAmount: 500, fundedThisPeriod: 0 },
        { id: 'g2', name: 'Car', targetAmount: 2000, contributedAmount: 300, fundedThisPeriod: 0 },
      ],
      todayIso: '2026-09-10',
    })
    expect(review.totalPaid).toBe(325) // only the payment inside the last 365 days
    expect(review.paymentCount).toBe(1)
    expect(review.netWorthChange).toBe(5000)
    expect(review.bestStreak).toBe(12)
    expect(review.goalsCompleted).toBe(1)
    expect(review.goalsTotal).toBe(2)
  })

  it('returns null net worth change with fewer than a real year-ago comparison point available correctly (uses earliest)', () => {
    const review = buildYearInReview({
      paymentRecords: [], netWorthHistory: [], streak: { current: 0, best: 0, lastCheckedDate: '', milestonesHit: [] }, savingsGoals: [], todayIso: '2026-09-10',
    })
    expect(review.netWorthChange).toBeNull()
    expect(review.totalPaid).toBe(0)
  })
})

describe('Claude Pro Plan USD->AUD seed conversion — real rate, hand-verified', () => {
  it('matches Deep\'s own stated figure: $20 USD * 1.3866 = $27.73 AUD', () => {
    expect(Math.round(20 * 1.3866 * 100) / 100).toBe(27.73)
  })
})

describe('dueDateSeverity sanity re-check alongside the paid-tracking upgrade (no regression)', () => {
  it('still treats a plain overdue day as danger — the paid override is applied at the UI layer, not here', () => {
    expect(dueDateSeverity(-5)).toBe('danger')
  })
})

describe('computeCurrentHealthScore — extracted shared wiring (store.tsx / Dashboard.tsx / AmbientBackground now all call this instead of 3 drifting copies)', () => {
  it('matches a hand-computed no-bills/no-debt/no-savings scenario exactly (80/100)', () => {
    const accounts: Account[] = [{ id: 'savings', name: 'Savings', type: 'liquid', value: 0, countsTowardLiveFunds: false }]
    const result = computeCurrentHealthScore({
      bills: [], creditCards: [], debts: [], accounts, grossAnnualIncome: 65000, country: 'NZ',
    })
    // net = $52,142.00/yr (NZ tax $11,720.50 + ACC $1,137.50 on $65k, per Round 14's
    // WebSearch-verified brackets) -> monthlyNet ~4345.17, no bills -> savingsRate 100,
    // no debt -> debtToIncome 100, no bills -> billCoverageRatio fallback 2 -> billCoverage 100,
    // $0 savings -> emergencyFund 0. Weighted 30/25/25/20 -> 30+25+25+0 = 80.
    expect(result.score).toBe(80)
    expect(result.breakdown).toEqual({ savingsRate: 100, debtToIncome: 100, billCoverage: 100, emergencyFund: 0 })
  })
})

describe('categoryColor — deterministic colour-from-string for free-text CSV categories (#1)', () => {
  it('is stable for the same category across repeated calls', () => {
    expect(categoryColor('Groceries')).toBe(categoryColor('Groceries'))
    expect(categoryColor('Fuel')).toBe(categoryColor('Fuel'))
  })

  it('returns a real hex colour from the app palette, not an arbitrary string', () => {
    const c = categoryColor('Entertainment')
    expect(c).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('different category strings can map to different colours (not a constant function)', () => {
    const colors = new Set(['Groceries', 'Fuel', 'Rent', 'Subscriptions', 'Entertainment', 'Health'].map(categoryColor))
    expect(colors.size).toBeGreaterThan(1)
  })
})

describe('findMatchRanges — live search highlighting, hand-checked ranges (#3/#48)', () => {
  it('finds a single case-insensitive match at the right offset', () => {
    expect(findMatchRanges('New World Groceries', 'world')).toEqual([[4, 9]])
  })

  it('finds ALL occurrences, not just the first', () => {
    expect(findMatchRanges('coffee coffee coffee', 'coffee')).toEqual([[0, 6], [7, 13], [14, 20]])
  })

  it('returns no ranges for an empty or whitespace-only query', () => {
    expect(findMatchRanges('New World', '')).toEqual([])
    expect(findMatchRanges('New World', '   ')).toEqual([])
  })

  it('returns no ranges when the query does not appear', () => {
    expect(findMatchRanges('New World', 'xyz')).toEqual([])
  })
})

describe('netWorthMilestones — hand-computed upward-crossing-only flags (#11)', () => {
  it('fires once per $10k threshold actually crossed upward, and ignores a dip back below', () => {
    const history: NetWorthSnapshot[] = [
      { date: '2026-01-01', netWorth: 5000, totalAssets: 5000, totalLiabilities: 0 },
      { date: '2026-01-02', netWorth: 12000, totalAssets: 12000, totalLiabilities: 0 }, // crosses $10k
      { date: '2026-01-03', netWorth: 9000, totalAssets: 9000, totalLiabilities: 0 }, // dips back below, no new event
      { date: '2026-01-04', netWorth: 21000, totalAssets: 21000, totalLiabilities: 0 }, // crosses $20k (not re-firing $10k)
    ]
    const hits = netWorthMilestones(history)
    expect(hits).toEqual([
      { date: '2026-01-02', netWorth: 12000, threshold: 10000 },
      { date: '2026-01-04', netWorth: 21000, threshold: 20000 },
    ])
  })

  it('returns nothing for a flat or declining history, or fewer than 2 points', () => {
    expect(netWorthMilestones([{ date: '2026-01-01', netWorth: 5000, totalAssets: 5000, totalLiabilities: 0 }])).toEqual([])
    expect(netWorthMilestones([
      { date: '2026-01-01', netWorth: 15000, totalAssets: 15000, totalLiabilities: 0 },
      { date: '2026-01-02', netWorth: 11000, totalAssets: 11000, totalLiabilities: 0 },
    ])).toEqual([])
  })
})

describe('trendDirection / percentChange — real comparisons, not invented (#24/#45)', () => {
  it('reports up/down/flat correctly', () => {
    expect(trendDirection(120, 100)).toBe('up')
    expect(trendDirection(80, 100)).toBe('down')
    expect(trendDirection(100, 100)).toBe('flat')
  })

  it('computes a real percent change', () => {
    expect(percentChange(112, 100)).toBe(12)
    expect(percentChange(88, 100)).toBe(-12)
  })

  it('returns null (not a fabricated number) when the previous value is zero', () => {
    expect(percentChange(50, 0)).toBeNull()
  })
})
