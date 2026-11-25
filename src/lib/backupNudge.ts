/**
 * When to remind you to back up. Everything in Clarity is stored only in this browser, so a cleared browser or a lost phone loses it all.
 * The reminder appears once there is something worth losing (some transactions, or several days of net worth history) and the last
 * backup or export is missing or over 30 days old. It never shows for a brand-new, empty app.
 */
export interface BackupNudge { show: boolean; text: string }

export function backupNudge(args: { lastExportedAt: string | null | undefined; todayIso: string; transactionCount: number; historyDays: number; dismissedUntilIso?: string | null }): BackupNudge {
  const hide = { show: false, text: '' }
  const { lastExportedAt, todayIso, transactionCount, historyDays, dismissedUntilIso } = args
  if (!/^\d{4}-\d{2}-\d{2}/.test(todayIso)) return hide
  if (dismissedUntilIso && /^\d{4}-\d{2}-\d{2}/.test(dismissedUntilIso) && todayIso <= dismissedUntilIso) return hide
  if (!(transactionCount > 0 || historyDays >= 3)) return hide
  const last = lastExportedAt ? Date.parse(lastExportedAt) : NaN
  if (!Number.isFinite(last)) return { show: true, text: 'Your data lives only in this browser and has never been backed up.' }
  const days = Math.floor((Date.parse(todayIso.slice(0, 10) + 'T12:00:00Z') - last) / 86_400_000)
  if (days > 30) return { show: true, text: `Your data lives only in this browser. The last backup was ${days} days ago.` }
  return hide
}

/** The day the reminder stays hidden until: a week from today. */
export function snoozeUntil(todayIso: string, days = 7): string {
  const [y, m, d] = todayIso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}
