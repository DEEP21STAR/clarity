import { describe, it, expect } from 'vitest'
import { emergencyFundRunwayDate, findLikelyDuplicateBills, runDataHealthCheck } from './logic'
import type { RecurringBill, CreditCardAccount, Account } from './types'

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
