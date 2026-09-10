import { describe, it, expect } from 'vitest'
import { fuzzyScore } from './commandPalette'

describe('fuzzyScore', () => {
  it('returns 0 for an empty query (matches everything, best rank)', () => {
    expect(fuzzyScore('Go to Dashboard', '')).toBe(0)
  })

  it('matches a contiguous substring near the start of the match with a low score', () => {
    // "Dashboard" starts at index 6; "dash" is fully contiguous within it (no gaps).
    // gapPenalty = 0, firstIndex = 6 -> score = 0*2 + 6 = 6
    expect(fuzzyScore('Go to Dashboard', 'dash')).toBe(6)
  })

  it('matches a scattered subsequence with a higher (worse) score than a contiguous one', () => {
    // g(0) t(3) d(6): gaps = (3-0-1)+(6-3-1) = 2+2 = 4, firstIndex = 0 -> score = 4*2+0 = 8
    expect(fuzzyScore('Go to Dashboard', 'gtd')).toBe(8)
    expect(fuzzyScore('Go to Dashboard', 'gtd')).toBeGreaterThan(fuzzyScore('Go to Dashboard', 'dash')!)
  })

  it('is case-insensitive', () => {
    expect(fuzzyScore('Go to Dashboard', 'DASH')).toBe(6)
  })

  it('returns null when the characters cannot be found in order', () => {
    expect(fuzzyScore('Go to Dashboard', 'xyz')).toBeNull()
    expect(fuzzyScore('Go to Dashboard', 'hsad')).toBeNull() // right letters, wrong order
  })

  it('rewards an earlier match start over a later one, all else equal', () => {
    // "up" appears at index 0 in "Upcoming" vs index further in "Go to Upcoming"
    const early = fuzzyScore('Upcoming Payments', 'up')
    const late = fuzzyScore('Go to Upcoming Payments', 'up')
    expect(early).not.toBeNull()
    expect(late).not.toBeNull()
    expect(early!).toBeLessThan(late!)
  })
})
