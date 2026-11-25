import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useStore } from '@/lib/store'
import { backupNudge, snoozeUntil } from '@/lib/backupNudge'
import { todayIso } from '@/lib/utils'

const SNOOZE_KEY = 'clarity-backup-snooze'

/** A slim reminder to back up when the data has never been (or not for 30+ days) saved off this device. "Back up now" opens Tools. */
export function BackupNudgeStrip() {
  const { state } = useStore()
  const today = todayIso()
  const [snoozed, setSnoozed] = useState<string | null>(() => { try { return localStorage.getItem(SNOOZE_KEY) } catch { return null } })
  const nudge = backupNudge({
    lastExportedAt: state.lastExportedAt, todayIso: today,
    transactionCount: Array.isArray(state.transactions) ? state.transactions.length : 0,
    historyDays: Array.isArray(state.netWorthHistory) ? state.netWorthHistory.length : 0,
    dismissedUntilIso: snoozed,
  })
  if (!nudge.show) return null
  return (
    <section aria-label="Backup reminder" data-testid="backup-nudge" className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] py-1 pl-4 pr-2">
      <p className="flex min-w-0 flex-1 basis-56 items-start gap-2 py-2 text-sm leading-snug text-amber-100">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
        <span>{nudge.text}</span>
      </p>
      <span className="flex items-center">
        <button type="button" aria-label="Back up now" onClick={() => window.dispatchEvent(new CustomEvent('clarity:goto-tab', { detail: 'tools' }))} className="min-h-11 rounded-full px-3 text-sm font-semibold text-cyan-200 transition-colors hover:bg-white/10">
          Back up
        </button>
        <button
          type="button" aria-label="Later: remind me next week"
          onClick={() => { const until = snoozeUntil(today); setSnoozed(until); try { localStorage.setItem(SNOOZE_KEY, until) } catch { /* ignore */ } }}
          className="min-h-11 rounded-full px-3 text-sm text-white/65 transition-colors hover:bg-white/10 hover:text-white"
        >
          Later
        </button>
      </span>
    </section>
  )
}
