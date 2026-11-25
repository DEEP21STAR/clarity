import { describe, expect, it } from 'vitest'
import { backupNudge, snoozeUntil } from './backupNudge'

const base = { todayIso: '2026-11-25', transactionCount: 10, historyDays: 0 }

describe('backupNudge', () => {
  it('stays quiet for an empty new app, even with no backup', () => {
    expect(backupNudge({ ...base, lastExportedAt: null, transactionCount: 0, historyDays: 1 }).show).toBe(false)
  })
  it('speaks once there is data to lose and no backup was ever made', () => {
    const n = backupNudge({ ...base, lastExportedAt: null })
    expect(n.show).toBe(true)
    expect(n.text).toContain('never been backed up')
    expect(backupNudge({ ...base, lastExportedAt: null, transactionCount: 0, historyDays: 5 }).show).toBe(true)
  })
  it('speaks when the last backup is over 30 days old, with the number of days', () => {
    const n = backupNudge({ ...base, lastExportedAt: '2026-10-01T00:00:00Z' })
    expect(n.show).toBe(true)
    expect(n.text).toMatch(/last backup was 55 days ago/)
  })
  it('stays quiet after a recent backup', () => {
    expect(backupNudge({ ...base, lastExportedAt: '2026-11-10T00:00:00Z' }).show).toBe(false)
    expect(backupNudge({ ...base, lastExportedAt: '2026-10-26T00:00:00Z' }).show).toBe(false) // 30 days is not over 30
  })
  it('honours a snooze, and ignores bad dates', () => {
    expect(backupNudge({ ...base, lastExportedAt: null, dismissedUntilIso: '2026-11-30' }).show).toBe(false)
    expect(backupNudge({ ...base, lastExportedAt: null, dismissedUntilIso: '2026-11-24' }).show).toBe(true)
    expect(backupNudge({ ...base, todayIso: 'nope', lastExportedAt: null }).show).toBe(false)
    expect(backupNudge({ ...base, lastExportedAt: 'garbage' }).show).toBe(true)
  })
  it('snoozes for a week', () => {
    expect(snoozeUntil('2026-11-25')).toBe('2026-12-02')
    expect(snoozeUntil('2026-12-28', 7)).toBe('2027-01-04')
  })
})
