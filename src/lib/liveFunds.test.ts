import { describe, it, expect } from 'vitest'
import { DEFAULT_STATE } from './store'
import { computeLiveFunds, applyQuickEntry } from './liveFunds'

const today = '2026-10-05'
const live = (s: typeof DEFAULT_STATE) => computeLiveFunds(s, today, 'week', s.householdView).liveFundsAvailable

describe('mobile quick entry vs Live Funds', () => {
  it('an expense lowers Live Funds by exactly its amount', () => {
    const before = live(DEFAULT_STATE)
    const after = live(applyQuickEntry(DEFAULT_STATE, { kind: 'expense', amount: 50, description: 'Lunch', date: today }, today, 'q1'))
    expect(Math.round((before - after) * 100) / 100).toBe(50)
  })
  it('income raises Live Funds by exactly its amount', () => {
    const before = live(DEFAULT_STATE)
    const after = live(applyQuickEntry(DEFAULT_STATE, { kind: 'income', amount: 120.5, description: 'Refund', date: today }, today, 'q2'))
    expect(Math.round((after - before) * 100) / 100).toBe(120.5)
  })
  it('a future-dated expense only records a one-off and leaves Live Funds unchanged', () => {
    const next = applyQuickEntry(DEFAULT_STATE, { kind: 'expense', amount: 30, description: 'x', date: '2026-10-20' }, today, 'q3')
    expect(live(next)).toBe(live(DEFAULT_STATE))
    expect(next.oneOffEntries[0].amount).toBe(-30)
  })
  it('ignores zero/negative amounts', () => {
    expect(applyQuickEntry(DEFAULT_STATE, { kind: 'expense', amount: 0, description: '', date: today }, today, 'q4')).toBe(DEFAULT_STATE)
  })
})
