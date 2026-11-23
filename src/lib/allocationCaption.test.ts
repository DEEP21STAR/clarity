import { describe, expect, it } from 'vitest'
import { allocationCaption } from './allocationCaption'

describe('allocationCaption', () => {
  it('keeps the original wording when there is money set aside', () => {
    expect(allocationCaption(200, 50)).toBe('$50.00 of $200.00 spent')
    expect(allocationCaption(200, 200)).toBe('$200.00 of $200.00 spent')
  })
  it('says how far over when spending passes the amount', () => {
    expect(allocationCaption(200, 230)).toBe('$30.00 over $230.00 of $200.00 spent')
  })
  it('says nothing is set aside when the amount is zero or negative, never "of -$X"', () => {
    expect(allocationCaption(-269.98, 0)).toBe('Short by $269.98 · nothing set aside this period')
    expect(allocationCaption(0, 0)).toBe('Short by $0.00 · nothing set aside this period')
    expect(allocationCaption(-100, 40)).toBe('Nothing set aside this period · $40.00 spent')
    expect(allocationCaption(-269.98, 0)).not.toContain('of -')
    // -168.735 rounds to -168.73 on the tile's big number; the caption must agree
    expect(allocationCaption(-168.735, 0)).toBe('Short by $168.73 · nothing set aside this period')
  })
})
