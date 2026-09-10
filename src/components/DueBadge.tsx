import { dueDateSeverity, dueInLabel, type DueSeverity } from '@/lib/logic'
import { cn } from '@/lib/utils'

/**
 * Shared traffic-light due-date pill — the ONE place every bill/plan/due-date
 * UI element (Recurring Bills table, Periodic Bill gauges, GEM VISA minimum
 * payments, Bill Calendar) gets its red/amber/green treatment from, so the
 * colour logic can never drift or duplicate between components. Recomputes
 * from `daysUntil` on every render, so it advances automatically as real
 * "today" advances — nothing here is set once and left stale.
 */
export function DueBadge({ daysUntil, className }: { daysUntil: number; className?: string }) {
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
    <span className={cn('inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium whitespace-nowrap', classes[severity], className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot[severity], severity !== 'ok' && 'animate-pulse')} />
      {dueInLabel(daysUntil)}
    </span>
  )
}
