import { describe, expect, it } from 'vitest'
import { DEFAULT_STATE, normaliseState } from './store'

describe('normaliseState (used by load and by backup restore)', () => {
  it('fills in fields an older backup does not have', () => {
    const old = { grossAnnualIncome: 72000 } as never
    const s = normaliseState(old, DEFAULT_STATE)
    expect(s.grossAnnualIncome).toBe(72000) // what the backup had wins
    expect(s.celebrationLevel).toBe(DEFAULT_STATE.celebrationLevel) // what it lacked comes from the defaults
    expect(Array.isArray(s.transactions)).toBe(true)
    expect(s.bills.length).toBe(DEFAULT_STATE.bills.length)
  })

  it('repairs malformed transactions without dropping any', () => {
    const s = normaliseState({ transactions: [{ id: 'a', date: '2026-10-05', description: 'ok', amount: -5, category: 'Food', mode: 'personal' }, { id: 'b', amount: '-3' }, null] } as never, DEFAULT_STATE)
    expect(s.transactions).toHaveLength(2)
    expect(s.transactions[1]).toMatchObject({ id: 'b', amount: -3, category: 'uncategorised', date: '' })
  })

  it('treats a null transaction list as empty', () => {
    expect(normaliseState({ transactions: null } as never, DEFAULT_STATE).transactions).toEqual([])
  })

  it('drops null and non-object rows from every saved list instead of crashing a screen later', () => {
    const s = normaliseState({
      accounts: [null, { id: 'a', name: 'Real', value: 10 }, 5], debts: [null], creditCards: ['x', null], savingsGoals: [undefined, null],
      sinkingFunds: [null], periodicBills: [null], oneOffEntries: [null], netWorthHistory: [null], paymentRecords: [null], deviceRepayments: [null], healthScoreHistory: [null],
    } as never, DEFAULT_STATE)
    expect(s.accounts).toEqual([{ id: 'a', name: 'Real', value: 10 }])
    for (const k of ['debts', 'creditCards', 'savingsGoals', 'sinkingFunds', 'periodicBills', 'oneOffEntries', 'netWorthHistory', 'paymentRecords', 'deviceRepayments', 'healthScoreHistory'] as const) expect(s[k], k).toEqual([])
  })

  it('replaces a saved list that is not a list with the default one, and leaves good lists as the same objects', () => {
    const acct = { id: 'a', name: 'Real', value: 10 }
    const s = normaliseState({ debts: 'oops', accounts: [acct] } as never, DEFAULT_STATE)
    expect(s.debts).toEqual(DEFAULT_STATE.debts)
    expect(s.accounts[0]).toBe(acct)
  })

  it('leaves every default (well-formed) bill exactly as it is', () => {
    const s = normaliseState({ bills: DEFAULT_STATE.bills } as never, DEFAULT_STATE)
    DEFAULT_STATE.bills.forEach((b, i) => expect(s.bills[i], b.name).toEqual(b))
  })

  it('repairs bills with a missing due day, a text amount or an unknown frequency without dropping them', () => {
    const s = normaliseState({ bills: [{ id: 'b1', name: 'Odd', active: true }, { id: 'b2', name: 'T', amount: 'lots', frequency: 'sometimes', category: 'zzz', dueDay: '15' }, null] } as never, DEFAULT_STATE)
    expect(s.bills).toHaveLength(2)
    expect(s.bills[0]).toMatchObject({ id: 'b1', amount: 0, frequency: 'monthly', dueDay: 1, category: 'other', active: true })
    expect(s.bills[0]).not.toHaveProperty('owner') // ownership is never guessed
    expect(s.bills[1]).toMatchObject({ amount: 0, frequency: 'monthly', dueDay: 15, category: 'other' })
  })
})
