import { describe, expect, it } from 'vitest'
import { levelScale } from './confetti'

describe('celebration levels', () => {
  it('scale the size of every burst', () => {
    expect(levelScale('off')).toBe(0)
    expect(levelScale('subtle')).toBeCloseTo(0.4)
    expect(levelScale('showtime')).toBe(1)
  })
  it('keep Subtle clearly smaller than Showtime but not nothing', () => {
    expect(levelScale('subtle')).toBeGreaterThan(0)
    expect(levelScale('subtle')).toBeLessThan(levelScale('showtime'))
  })
})
