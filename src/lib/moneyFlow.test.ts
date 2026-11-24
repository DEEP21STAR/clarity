import { describe, expect, it } from 'vitest'
import { buildMoneyFlow, flowBands } from './moneyFlow'

const parts = [{ name: 'housing', value: 2000, color: '#a' }, { name: 'utilities', value: 200, color: '#b' }, { name: 'bad', value: 0, color: '#c' }]

describe('buildMoneyFlow', () => {
  it('splits income into bills by size, then leftover', () => {
    const f = buildMoneyFlow(4000, parts)!
    expect(f.parts.map((p) => p.name)).toEqual(['housing', 'utilities', 'leftover'])
    expect(f.leftover).toBe(1800)
    expect(f.shortfall).toBe(0)
    expect(f.total).toBe(4000)
  })
  it('reports a shortfall when bills are more than income, with no leftover part', () => {
    const f = buildMoneyFlow(1500, parts)!
    expect(f.parts.map((p) => p.name)).toEqual(['housing', 'utilities'])
    expect(f.shortfall).toBe(700)
    expect(f.total).toBe(2200)
  })
  it('returns null with no income or no bills, and ignores bad numbers', () => {
    expect(buildMoneyFlow(0, parts)).toBeNull()
    expect(buildMoneyFlow(NaN, parts)).toBeNull()
    expect(buildMoneyFlow(4000, [])).toBeNull()
    expect(buildMoneyFlow(4000, [{ name: 'x', value: NaN, color: '#0' }])).toBeNull()
  })
})

describe('flowBands', () => {
  it('fills the income column and leaves gaps between target nodes', () => {
    const f = buildMoneyFlow(4000, parts)!
    const b = flowBands(f, 100, 4)
    expect(b[0].y0).toBe(0)
    expect(b[b.length - 1].y1).toBeCloseTo(92, 5) // 100 minus two 4px gaps, source side is continuous
    expect(b[1].ty0 - b[0].ty1).toBeCloseTo(4, 5)
    expect(b[b.length - 1].ty1).toBeCloseTo(100, 5)
  })
})
