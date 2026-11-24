import { describe, expect, it } from 'vitest'
import { isEditing, reloadAllowed } from './swUpdate'

describe('swUpdate helpers', () => {
  it('only waits for a field the person is typing in', () => {
    const input = document.createElement('input'); const div = document.createElement('div'); const ta = document.createElement('textarea')
    expect(isEditing(input)).toBe(true)
    expect(isEditing(ta)).toBe(true)
    expect(isEditing(div)).toBe(false)
    expect(isEditing(null)).toBe(false)
  })
  it('never reloads twice within 15 seconds', () => {
    const now = 1_000_000
    expect(reloadAllowed(now, null)).toBe(true)
    expect(reloadAllowed(now, 'junk')).toBe(true)
    expect(reloadAllowed(now, String(now - 3_000))).toBe(false)
    expect(reloadAllowed(now, String(now - 15_001))).toBe(true)
  })
})
