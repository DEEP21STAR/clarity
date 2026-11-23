import { describe, expect, it } from 'vitest'
import { sanitizeTransactions } from './sanitize'

const good = { id: 'a', date: '2026-10-05', description: 'Pak n Save', amount: -42.5, category: 'Groceries', mode: 'personal' }

describe('sanitizeTransactions', () => {
  it('returns a well-formed row as the very same object', () => {
    const [out] = sanitizeTransactions([good])
    expect(out).toBe(good)
  })

  it('keeps every row and only repairs the malformed fields', () => {
    const out = sanitizeTransactions([
      { ...good, category: null },
      { ...good, id: 'b', category: undefined },
      { ...good, id: 'c', amount: '-12.5' },
      { ...good, id: 'd', amount: null },
      { ...good, id: 'e', date: 20261105 },
      { ...good, id: 'f', date: undefined },
      { ...good, id: 'g', description: null, mode: 'weird' },
    ])
    expect(out).toHaveLength(7)
    expect(out[0].category).toBe('uncategorised')
    expect(out[1].category).toBe('uncategorised')
    expect(out[2].amount).toBe(-12.5)
    expect(out[3].amount).toBe(0)
    expect(out[4].date).toBe('20261105')
    expect(out[5].date).toBe('')
    expect(out[6]).toMatchObject({ description: '', mode: 'personal' })
    // the fields that were fine are untouched
    expect(out[2]).toMatchObject({ date: '2026-10-05', description: 'Pak n Save', category: 'Groceries' })
  })

  it('treats a missing or non-list value as an empty list and skips non-objects', () => {
    expect(sanitizeTransactions(null)).toEqual([])
    expect(sanitizeTransactions(undefined)).toEqual([])
    expect(sanitizeTransactions('nope')).toEqual([])
    expect(sanitizeTransactions([null, 5, 'x', good])).toEqual([good])
  })
})
