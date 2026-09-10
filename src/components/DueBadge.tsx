import { dueDateSeverity, dueInLabel, daysBetweenIso, type DueSeverity } from '@/lib/logic'
import { cn, todayIso, formatShortDate } from '@/lib/utils'

/**
 * Shared traffic-light due-date pill — the ONE place every bill/plan/due-date
 * UI element (Recurring Bills table, Periodic Bill gauges, GEM VISA minimum
 * payments, Bill Calendar) gets its red/amber/green treatment from, so the
 * colour logic can never drift or duplicate between components.
 *
 * Round 20 (expanded mid-build): takes the real ISO due date, not just a
 * pre-computed days-until — Deep specifically flagged that only the
 * relative "due in 7 days" was shown anywhere, with no actual calendar date
 * visible. The real date is now the PRIMARY label; the relative distance is
 * a secondary, muted suffix. Severity/relative-label still recompute from
 * real "today" on every render, so nothing here is set once and goes stale.
 */
export function DueBadge({ dueDateIso, className }: { dueDateIso: string; className?: string }) {
  const daysUntil = daysBetweenIso(todayIso(), dueDateIso)
  const severity = dueDateSeverity(daysUntil)
  const classes: Record<DueSeverity, string> = {
    ok: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30',
    warn: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    danger: 'bg-rose-500/15 text-rose-300 border-rose-400/40',
  }
  const dot: Record<DueSeverity, string> = {
    ok: 'bg-emerald-400',
    warn: 'bg-amber-400',
    danger: 'bg-rose-400',
  }
  return (
    <span
      title={`Due ${dueDateIso} — ${dueInLabel(daysUntil)}`}
      className={cn('inline-flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded-full border font-medium whitespace-nowrap', classes[severity], className)}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot[severity], severity !== 'ok' && 'animate-pulse')} />
      <span className="font-semibold">{formatShortDate(dueDateIso)}</span>
      <span className="opacity-60">· {dueInLabel(daysUntil)}</span>
    </span>
  )
}
