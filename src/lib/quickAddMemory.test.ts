import { describe, expect, it } from 'vitest'
import { parseLastCategory, readLastCategory, writeLastCategory, QUICK_ADD_KEY } from './quickAddMemory'

describe('quick-add category memory', () => {
  it('accepts only real categories', () => {
    expect(parseLastCategory('fuel')).toBe('fuel')
    expect(parseLastCategory('extraUsage')).toBe('extraUsage')
    expect(parseLastCategory('nonsense')).toBeNull()
    expect(parseLastCategory(null)).toBeNull()
    expect(parseLastCategory(undefined)).toBeNull()
  })
  it('round-trips through storage and survives broken storage', () => {
    const mem: Record<string, string> = {}
    const s = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v } }
    expect(readLastCategory(s)).toBeNull()
    writeLastCategory(s, 'food')
    expect(mem[QUICK_ADD_KEY]).toBe('food')
    expect(readLastCategory(s)).toBe('food')
    expect(readLastCategory({ getItem: () => { throw new Error('blocked') } })).toBeNull()
    expect(() => writeLastCategory({ setItem: () => { throw new Error('blocked') } }, 'fuel')).not.toThrow()
  })
})
