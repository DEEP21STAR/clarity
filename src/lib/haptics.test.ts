import { describe, expect, it } from 'vitest'
import { hapticPattern, type HapticEnv } from './haptics'

const on: HapticEnv = { hasVibrate: true, coarsePointer: true, reducedMotion: false, enabled: true }
describe('hapticPattern', () => {
  it('gives each kind its own feel on a touch phone', () => {
    expect(hapticPattern('tap', on)).toBe(8)
    expect(hapticPattern('success', on)).toEqual([10, 40, 16])
    expect(hapticPattern('warn', on)).toEqual([24, 50, 24])
  })
  it('stays silent without vibration support, without touch, with reduced motion, or when switched off', () => {
    expect(hapticPattern('tap', { ...on, hasVibrate: false })).toBeNull()
    expect(hapticPattern('tap', { ...on, coarsePointer: false })).toBeNull()
    expect(hapticPattern('success', { ...on, reducedMotion: true })).toBeNull()
    expect(hapticPattern('success', { ...on, enabled: false })).toBeNull()
  })
})
