import { describe, it, expect } from 'vitest'
import { supportPrompt, afterDismiss, afterSupport, readSupportMemory, EMPTY_SUPPORT_MEMORY, type SupportMemory } from './supportPrompt'

const mem = (o: Partial<SupportMemory> = {}): SupportMemory => ({ ...EMPTY_SUPPORT_MEMORY, firstSeen: '2026-11-01', ...o })
const USED = { transactions: 12, bills: 0 }

describe('supportPrompt: only after Clarity has earned it, and never nags', () => {
  it('stays quiet in the first week', () => {
    expect(supportPrompt({ todayIso: '2026-11-07', memory: mem(), ...USED })).toBe(false)
    expect(supportPrompt({ todayIso: '2026-11-08', memory: mem(), ...USED })).toBe(true)
  })
  it('needs real use: 10+ transactions or 3+ bills', () => {
    expect(supportPrompt({ todayIso: '2026-12-01', memory: mem(), transactions: 9, bills: 2 })).toBe(false)
    expect(supportPrompt({ todayIso: '2026-12-01', memory: mem(), transactions: 10, bills: 0 })).toBe(true)
    expect(supportPrompt({ todayIso: '2026-12-01', memory: mem(), transactions: 0, bills: 3 })).toBe(true)
  })
  it('never shows before the first-opened day is known', () => {
    expect(supportPrompt({ todayIso: '2026-12-01', memory: EMPTY_SUPPORT_MEMORY, ...USED })).toBe(false)
  })
  it('waits 30 days after a "Not now", then 90 after the second, then 90 again, then stops after four', () => {
    let m = mem()
    m = afterDismiss(m, '2026-12-01')
    expect(supportPrompt({ todayIso: '2026-12-30', memory: m, ...USED })).toBe(false)
    expect(supportPrompt({ todayIso: '2026-12-31', memory: m, ...USED })).toBe(true)
    m = afterDismiss(m, '2026-12-31')                 // second answer: 90-day gap from now on
    expect(supportPrompt({ todayIso: '2027-03-30', memory: m, ...USED })).toBe(false)
    expect(supportPrompt({ todayIso: '2027-03-31', memory: m, ...USED })).toBe(true)
    m = afterDismiss(afterDismiss(m, '2027-03-31'), '2027-07-01')
    expect(m.dismissals).toBe(4)
    expect(supportPrompt({ todayIso: '2030-01-01', memory: m, ...USED })).toBe(false)
  })
  it('stays quiet for a year after the coffee button is tapped', () => {
    const m = afterSupport(mem(), '2026-12-01')
    expect(supportPrompt({ todayIso: '2027-11-30', memory: m, ...USED })).toBe(false)
    expect(supportPrompt({ todayIso: '2027-12-02', memory: m, ...USED })).toBe(true)
  })
  it('ignores a bad date instead of crashing', () => {
    expect(supportPrompt({ todayIso: 'soon', memory: mem(), ...USED })).toBe(false)
  })
})

describe('readSupportMemory: a damaged stored value can never break the app', () => {
  it('reads a good value', () => {
    expect(readSupportMemory(JSON.stringify({ firstSeen: '2026-11-01', lastAsked: '2026-12-01', dismissals: 2, supported: null }))).toEqual({ firstSeen: '2026-11-01', lastAsked: '2026-12-01', dismissals: 2, supported: null })
  })
  it('falls back to empty for nonsense', () => {
    for (const bad of [null, '', 'not json', '[]', '5', '{"dismissals":"x","firstSeen":7}']) expect(readSupportMemory(bad)).toEqual(EMPTY_SUPPORT_MEMORY)
  })
  it('caps and cleans numbers and dates', () => {
    expect(readSupportMemory('{"dismissals":-3,"firstSeen":"yesterday"}').dismissals).toBe(0)
    expect(readSupportMemory('{"dismissals":9999}').dismissals).toBe(99)
  })
})
