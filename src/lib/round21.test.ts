import { describe, it, expect } from 'vitest'
import { emergencyFundRunwayDate, findLikelyDuplicateBills, runDataHealthCheck, creditCardsAsDebts, minPaymentCycleStatus, guessTransactionCategory } from './logic'
import type { RecurringBill, CreditCardAccount, Account, PaymentRecord } from './types'

function paymentRecord(overrides: Partial<PaymentRecord> & { id: string; targetId: string; amount: number; date: string }): PaymentRecord {
  return { targetType: 'creditCard', targetLabel: 'GEM VISA Deep', recordedAt: `${overrides.date}T12:00:00.000Z`, ...overrides }
}

const RATES = { purchase: 0.2, cashAdvance: 0.22, interestFreePlan: 0, expiredPlanRate: 0.25 }
function card(overrides: Partial<CreditCardAccount> & { id: string; name: string; balance: number }): CreditCardAccount {
  return { availableToSpend: 0, minPayment: 0, rates: RATES, plans: [], owner: 'shared', ...overrides }
}
function account(overrides: Partial<Account> & { id: string; name: string; value: number }): Account {
  return { type: 'liquid', countsTowardLiveFunds: true, ...overrides }
}

function bill(overrides: Partial<RecurringBill> & { id: string; name: string; amount: number }): RecurringBill {
  return {
    frequency: 'monthly',
    dueDay: 1,
    dueDayIsEstimate: false,
    category: 'other',
    active: true,
    owner: 'shared',
    ...overrides,
  }
}

describe('emergencyFundRunwayDate', () => {
  it('projects 6 months forward using a real average month length (365.25/12 days)', () => {
    // 6 * 30.4375 = 182.625 -> rounds to 183 days. Jan 1 2026 + 183 days:
    // Jan31(30) Feb28(58) Mar31(89) Apr30(119) May31(150) Jun30(180) +3 -> Jul 3 2026.
    expect(emergencyFundRunwayDate(6, '2026-01-01')).toBe('2026-07-03')
  })

  it('projects 1 month forward as ~30 days', () => {
    // round(30.4375) = 30 days -> Jan 1 + 30 = Jan 31.
    expect(emergencyFundRunwayDate(1, '2026-01-01')).toBe('2026-01-31')
  })

  it('returns null for zero or negative months (no real runway to project)', () => {
    expect(emergencyFundRunwayDate(0, '2026-01-01')).toBeNull()
    expect(emergencyFundRunwayDate(-2, '2026-01-01')).toBeNull()
  })
})

describe('findLikelyDuplicateBills', () => {
  it('flags an exact-name duplicate regardless of amount difference', () => {
    const bills = [
      bill({ id: 'a', name: 'Power', amount: 150 }),
      bill({ id: 'b', name: 'power', amount: 200 }), // case-insensitive exact match
    ]
    const warnings = findLikelyDuplicateBills(bills)
    expect(warnings).toHaveLength(1)
    expect([warnings[0].a.id, warnings[0].b.id].sort()).toEqual(['a', 'b'])
  })

  it('flags a related name (substring) with a close amount', () => {
    const bills = [
      bill({ id: 'a', name: 'Netflix', amount: 19.99 }),
      bill({ id: 'b', name: 'Netflix Premium', amount: 19.99 }),
    ]
    expect(findLikelyDuplicateBills(bills)).toHaveLength(1)
  })

  it('does NOT flag a related name when the amounts genuinely differ (real price tiers)', () => {
    const bills = [
      bill({ id: 'a', name: 'Netflix', amount: 9.99 }),
      bill({ id: 'b', name: 'Netflix Premium', amount: 24.99 }),
    ]
    expect(findLikelyDuplicateBills(bills)).toHaveLength(0)
  })

  it('does NOT flag unrelated names that merely share an amount and frequency', () => {
    const bills = [
      bill({ id: 'a', name: 'Power', amount: 150 }),
      bill({ id: 'b', name: 'Internet', amount: 150 }),
    ]
    expect(findLikelyDuplicateBills(bills)).toHaveLength(0)
  })

  it('does NOT flag the same name at a different frequency', () => {
    const bills = [
      bill({ id: 'a', name: 'Insurance', amount: 40, frequency: 'monthly' }),
      bill({ id: 'b', name: 'Insurance', amount: 40, frequency: 'fortnightly' }),
    ]
    expect(findLikelyDuplicateBills(bills)).toHaveLength(0)
  })

  it('ignores inactive bills entirely', () => {
    const bills = [
      bill({ id: 'a', name: 'Power', amount: 150, active: false }),
      bill({ id: 'b', name: 'power', amount: 150, active: false }),
    ]
    expect(findLikelyDuplicateBills(bills)).toHaveLength(0)
  })
})

describe('runDataHealthCheck', () => {
  it('returns no findings for a clean, consistent state', () => {
    const findings = runDataHealthCheck({
      bills: [bill({ id: 'a', name: 'Power', amount: 150 })],
      creditCards: [card({ id: 'c1', name: 'GEM VISA', balance: 500, creditLimit: 2000 })],
      accounts: [account({ id: 'hsbc', name: 'HSBC', value: 1200 }), account({ id: 'overdraft', name: 'Overdraft', value: -300 })],
    })
    expect(findings).toHaveLength(0)
  })

  it('flags a likely duplicate bill', () => {
    const findings = runDataHealthCheck({
      bills: [bill({ id: 'a', name: 'Power', amount: 150 }), bill({ id: 'b', name: 'power', amount: 150 })],
      creditCards: [],
      accounts: [],
    })
    expect(findings.filter((f) => f.id.startsWith('dup-'))).toHaveLength(1)
  })

  it('flags an active bill sitting at $0', () => {
    const findings = runDataHealthCheck({
      bills: [bill({ id: 'a', name: 'New bill', amount: 0 })],
      creditCards: [],
      accounts: [],
    })
    expect(findings).toEqual([{ id: 'zero-amount-a', severity: 'info', message: '"New bill" is active with a $0 amount — likely still needs its real amount filled in.' }])
  })

  it('flags a credit card balance that exceeds its own stated limit', () => {
    const findings = runDataHealthCheck({
      bills: [],
      creditCards: [card({ id: 'c1', name: 'GEM VISA', balance: 2500, creditLimit: 2000 })],
      accounts: [],
    })
    expect(findings).toEqual([{ id: 'overlimit-c1', severity: 'warning', message: "GEM VISA's balance ($2500.00) exceeds its stated credit limit ($2000.00) — check for a typo in either figure." }])
  })

  it('does not flag a credit card with no stated credit limit', () => {
    const findings = runDataHealthCheck({
      bills: [],
      creditCards: [card({ id: 'c1', name: 'GEM VISA', balance: 2500 })],
      accounts: [],
    })
    expect(findings).toHaveLength(0)
  })

  it('flags a negative balance on a non-Overdraft liquid account, but not Overdraft itself', () => {
    const findings = runDataHealthCheck({
      bills: [],
      creditCards: [],
      accounts: [account({ id: 'hsbc', name: 'HSBC', value: -50 }), account({ id: 'overdraft', name: 'Overdraft', value: -300 })],
    })
    expect(findings).toEqual([{ id: 'negative-hsbc', severity: 'warning', message: 'HSBC has a negative balance ($-50.00) — only Overdraft is expected to go negative.' }])
  })

  it('does not flag a negative value on a non-liquid asset account (manually maintained, can legitimately be anything)', () => {
    const findings = runDataHealthCheck({
      bills: [],
      creditCards: [],
      accounts: [account({ id: 'asset-car', name: 'Car', value: -100, type: 'asset', countsTowardLiveFunds: false })],
    })
    expect(findings).toHaveLength(0)
  })
})

const GEM_VISA_RATES = { purchase: 0.2899, cashAdvance: 0.2999, interestFreePlan: 0, expiredPlanRate: 0.2999 }

describe('creditCardsAsDebts', () => {
  it("maps a card's real balance and purchase APR into a Debt-shaped entry (Deep's real GEM VISA Deep numbers)", () => {
    const debts = creditCardsAsDebts([
      card({ id: 'card-gem-visa-deep', name: 'GEM VISA Deep', balance: 9575.25, minPayment: 305.33, rates: GEM_VISA_RATES }),
    ])
    expect(debts).toEqual([{ id: 'card-debt-card-gem-visa-deep', name: 'GEM VISA Deep', balance: 9575.25, apr: 0.2899, minPayment: 305.33 }])
  })

  it('excludes a card with a zero or negative balance (nothing owed = not a debt)', () => {
    expect(creditCardsAsDebts([card({ id: 'c1', name: 'Paid off card', balance: 0 })])).toHaveLength(0)
  })

  it("real bug found via the live avalanche simulation: a card with a genuine $0 minPayment (Mimi's real case — 'None due' this cycle) still gets a real fallback minimum, not a literal $0 that would let its balance compound unpaid forever", () => {
    const debts = creditCardsAsDebts([
      card({ id: 'card-gem-visa-mimi', name: 'GEM VISA Mimi', balance: 3027.79, minPayment: 0, rates: GEM_VISA_RATES }),
    ])
    // max(25, 3027.79 * 0.02) = max(25, 60.5558) = 60.56 — same baseline-minimum convention
    // planPayoffWithExtra() already uses for expired plans with no published minimum.
    expect(debts[0].minPayment).toBe(60.56)
  })

  it('maps multiple cards independently, preserving each real balance/APR', () => {
    const debts = creditCardsAsDebts([
      card({ id: 'card-gem-visa-deep', name: 'GEM VISA Deep', balance: 9575.25, minPayment: 305.33, rates: GEM_VISA_RATES }),
      card({ id: 'card-gem-visa-mimi', name: 'GEM VISA Mimi', balance: 3027.79, minPayment: 0, rates: GEM_VISA_RATES }),
    ])
    expect(debts).toHaveLength(2)
    expect(debts.reduce((s, d) => s + d.balance, 0)).toBe(9575.25 + 3027.79)
  })
})

describe('minPaymentCycleStatus', () => {
  const CARD = { id: 'card-gem-visa-deep', minPayment: 305.33, minPaymentDueDate: '2026-09-17' }
  // oneMonthBefore('2026-09-17') = '2026-08-17' (real calendar month subtraction, not -30 days)

  it("Deep's real case — $325 paid against a $305.33 minimum already exceeds it: shows as satisfied", () => {
    const records = [paymentRecord({ id: 'p1', targetId: CARD.id, amount: 325, date: '2026-09-05' })]
    const status = minPaymentCycleStatus(CARD, records, '2026-09-11')
    expect(status.met).toBe(true)
    expect(status.cycleToDatePayments).toBe(325)
    expect(status.remaining).toBe(0)
  })

  it('a partial payment under the minimum shows the real reduced remaining amount, not satisfied', () => {
    const records = [paymentRecord({ id: 'p1', targetId: CARD.id, amount: 150, date: '2026-09-05' })]
    const status = minPaymentCycleStatus(CARD, records, '2026-09-11')
    expect(status.met).toBe(false)
    expect(status.cycleToDatePayments).toBe(150)
    expect(status.remaining).toBe(155.33) // 305.33 - 150, exact
  })

  it('no payments recorded this cycle: remaining equals the full minimum, not satisfied', () => {
    const status = minPaymentCycleStatus(CARD, [], '2026-09-11')
    expect(status.met).toBe(false)
    expect(status.cycleToDatePayments).toBe(0)
    expect(status.remaining).toBe(305.33)
  })

  it('excludes a payment made in the PREVIOUS cycle (before the cycle start), even against the same card', () => {
    const records = [paymentRecord({ id: 'old', targetId: CARD.id, amount: 500, date: '2026-08-10' })] // before 2026-08-17 cycle start
    const status = minPaymentCycleStatus(CARD, records, '2026-09-11')
    expect(status.met).toBe(false)
    expect(status.cycleToDatePayments).toBe(0)
  })

  it('excludes payments against a different card', () => {
    const records = [paymentRecord({ id: 'other', targetId: 'card-gem-visa-mimi', amount: 500, date: '2026-09-05' })]
    const status = minPaymentCycleStatus(CARD, records, '2026-09-11')
    expect(status.cycleToDatePayments).toBe(0)
  })

  it('sums multiple real payments within the same cycle toward the minimum', () => {
    const records = [
      paymentRecord({ id: 'p1', targetId: CARD.id, amount: 100, date: '2026-08-20' }),
      paymentRecord({ id: 'p2', targetId: CARD.id, amount: 100, date: '2026-09-01' }),
      paymentRecord({ id: 'p3', targetId: CARD.id, amount: 105.33, date: '2026-09-10' }),
    ]
    const status = minPaymentCycleStatus(CARD, records, '2026-09-11')
    expect(status.cycleToDatePayments).toBe(305.33)
    expect(status.met).toBe(true)
    expect(status.remaining).toBe(0)
  })

  it('a card with no real minimum payment due is trivially always satisfied', () => {
    const status = minPaymentCycleStatus({ id: 'card-gem-visa-mimi', minPayment: 0, minPaymentDueDate: undefined }, [], '2026-09-11')
    expect(status.met).toBe(true)
    expect(status.remaining).toBe(0)
  })
})

describe('guessTransactionCategory', () => {
  it('matches real fuel-station merchant descriptions', () => {
    expect(guessTransactionCategory('AMPOL FOODARY HAMILTON')).toBe('Fuel')
    expect(guessTransactionCategory('BP CONNECT AUCKLAND')).toBe('Fuel')
  })

  it('matches real supermarket descriptions as Groceries, not Food', () => {
    expect(guessTransactionCategory('WOOLWORTHS METRO 1234')).toBe('Groceries')
    expect(guessTransactionCategory('COLES EXPRESS SYDNEY')).toBe('Groceries')
  })

  it('matches real fast-food/restaurant descriptions as Food', () => {
    expect(guessTransactionCategory('KFC PAPATOETOE')).toBe('Food')
    expect(guessTransactionCategory('UBER EATS SYD0123')).toBe('Food')
  })

  it('matches real telco descriptions as Internet & Mobile', () => {
    expect(guessTransactionCategory('SPARK NZ LTD')).toBe('Internet & Mobile')
    expect(guessTransactionCategory('VODAFONE AU')).toBe('Internet & Mobile')
  })

  it('matches bank-fee/interest line items', () => {
    expect(guessTransactionCategory('INTEREST CHARGED ON PURCHASES')).toBe('Bank Fees')
  })

  it('falls back to uncategorised for a genuinely unrecognisable description', () => {
    expect(guessTransactionCategory('XYZ CORP 998271')).toBe('uncategorised')
  })

  it('is case-insensitive', () => {
    expect(guessTransactionCategory('ampol foodary')).toBe('Fuel')
  })
})
