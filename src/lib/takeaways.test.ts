import { describe, it, expect } from 'vitest'
import { monthlySavingPotential, parseNutryosCode, savedSoFar } from './takeaways'

describe('takeaway savings estimates', () => {
  it('is null without a cost', () => {
    expect(savedSoFar({ days: 10, asOf: null, cost: null, perWeek: 2 })).toBeNull()
  })
  it('scales by how often takeaways used to happen', () => {
    expect(savedSoFar({ days: 14, asOf: null, cost: 24, perWeek: 2 })).toBe(96)
    expect(savedSoFar({ days: 7, asOf: null, cost: 20, perWeek: 3 })).toBe(60)
  })
  it('projects a takeaway-free month', () => {
    expect(monthlySavingPotential({ days: 0, asOf: null, cost: 24, perWeek: 2 })).toBe(208)
  })
})

describe('parseNutryosCode', () => {
  it('parses the full code', () => {
    expect(parseNutryosCode('NUTRYOS-TF:9:2026-10-09:24:2')).toEqual({ days: 9, asOf: '2026-10-09', cost: 24, perWeek: 2 })
  })
  it('parses days only', () => {
    expect(parseNutryosCode(' NUTRYOS-TF:3:2026-10-09 ')).toEqual({ days: 3, asOf: '2026-10-09' })
  })
  it('rejects anything else', () => {
    expect(parseNutryosCode('hello')).toBeNull()
    expect(parseNutryosCode('NUTRYOS-TF:x:2026-10-09')).toBeNull()
  })
})
