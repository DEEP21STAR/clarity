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
})
