import { describe, expect, it } from 'vitest'
import { RELEASE, shouldShowWhatsNew } from './whatsNew'

describe('shouldShowWhatsNew', () => {
  const base = { releaseId: '2026-11-25', transactionCount: 5, historyDays: 0 }
  it('shows once for someone with data who has not seen this release', () => {
    expect(shouldShowWhatsNew({ ...base, seenId: null })).toBe(true)
    expect(shouldShowWhatsNew({ ...base, seenId: '2026-10-01' })).toBe(true)
  })
  it('stays hidden once this release is seen', () => {
    expect(shouldShowWhatsNew({ ...base, seenId: '2026-11-25' })).toBe(false)
  })
  it('stays hidden for a brand-new app with nothing in it', () => {
    expect(shouldShowWhatsNew({ ...base, seenId: null, transactionCount: 0, historyDays: 1 })).toBe(false)
    expect(shouldShowWhatsNew({ ...base, seenId: null, transactionCount: 0, historyDays: 3 })).toBe(true)
  })
  it('the real release has an id, items, and only links to real screens', () => {
    expect(RELEASE.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(RELEASE.items.length).toBeGreaterThan(2)
    for (const i of RELEASE.items) { expect(i.text.length).toBeGreaterThan(10); if (i.tab) expect(['budgets', 'networth', 'dashboard', 'tools', 'upcoming', 'debts', 'calendar', 'transactions', 'shopping']).toContain(i.tab) }
  })
})
