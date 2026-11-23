import { useMemo, useState } from 'react'
import { Target } from 'lucide-react'
import { useStore } from '@/lib/store'
import { computeBudgetRows, daysInMonth, suggestionsToApply, trimSaving, type BudgetRow, type BudgetStatus } from '@/lib/categoryBudgets'
import { categoryColor } from '@/lib/logic'
import { cn, formatCurrency, todayIso } from '@/lib/utils'
import { StatCard } from './StatCard'

/** Categories offered as ready-to-fill rows before you have any spending history. */
const COMMON = ['Groceries', 'Food', 'Fuel', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Subscriptions', 'Utilities']

const STATUS_LABEL: Record<BudgetStatus, string> = { ok: 'On track', watch: 'Watch', over: 'Over', unset: 'No target' }
const STATUS_TEXT: Record<BudgetStatus, string> = { ok: 'text-emerald-300', watch: 'text-amber-300', over: 'text-rose-300', unset: 'text-white/60' }
const STATUS_BAR: Record<BudgetStatus, string> = { ok: 'bg-emerald-400', watch: 'bg-amber-400', over: 'bg-rose-400', unset: 'bg-white/30' }

function detail(r: BudgetRow): string {
  if (r.status === 'unset') return r.spent > 0 ? `${formatCurrency(r.spent)} spent so far this month` : 'Set a monthly target to track it'
  if (r.remaining < 0) return `${formatCurrency(-r.remaining)} over your ${formatCurrency(r.target)} target`
  const per = r.perDayLeft > 0 ? ` · about ${formatCurrency(r.perDayLeft)} a day for ${r.daysLeft === 0 ? 'today' : `the next ${r.daysLeft + 1} days`}` : ''
  return `${formatCurrency(r.remaining)} left${per}`
}

/**
 * Monthly targets per category with live progress. The thin tick on each bar marks where you would be if you spent evenly through
 * the month, so "on track" means the bar is at or behind the tick. Rollover (carry last month's unspent amount forward) is off
 * unless you switch it on for a category. Status is always written out, never colour alone.
 */
export function CategoryBudgets() {
  const { state, setCategoryBudget } = useStore()
  const today = todayIso()
  const [showAll, setShowAll] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const rows = useMemo(() => computeBudgetRows(state.categoryBudgets ?? {}, state.transactions, today, COMMON), [state.categoryBudgets, state.transactions, today])
  const active = rows.filter((r) => r.status !== 'unset' || r.spent > 0)
  const idle = rows.filter((r) => r.status === 'unset' && r.spent === 0)
  const visibleIdle = showAll || active.length === 0 ? idle.slice(0, showAll ? idle.length : 5) : []

  const toApply = suggestionsToApply(rows)
  const [applied, setApplied] = useState<number | null>(null)
  const applyAll = () => {
    toApply.forEach((t) => setCategoryBudget(t.category, { monthly: t.monthly }))
    setApplied(toApply.length)
  }
  const budgeted = rows.filter((r) => r.target > 0)
  const totalTarget = budgeted.reduce((s, r) => s + r.target, 0)
  const totalSpent = budgeted.reduce((s, r) => s + r.spent, 0)
  const day = Number(today.slice(8, 10)) || 1
  const dim = daysInMonth(today.slice(0, 7))

  const commit = (category: string, current: number) => {
    const raw = drafts[category]
    if (raw === undefined) return
    const n = parseFloat(raw)
    if (Number.isFinite(n) && n > 0) setCategoryBudget(category, { monthly: n })
    else if (current > 0 && raw.trim() === '') setCategoryBudget(category, { monthly: 0 })
    setDrafts((d) => { const next = { ...d }; delete next[category]; return next })
  }

  const renderRow = (r: BudgetRow) => {
    const pct = Math.min(100, Math.round(r.pctSpent * 100))
    const trim = trimSaving(r.monthly)
    return (
      <li key={r.category} className="rounded-xl border border-white/10 bg-black/25 p-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: categoryColor(r.category) }} aria-hidden="true" />
            <span className="truncate text-sm font-semibold text-white/90">{r.category}</span>
            <span className={cn('rounded-full border border-current px-2 py-0.5 text-xs font-bold uppercase tracking-wide', STATUS_TEXT[r.status])}>{STATUS_LABEL[r.status]}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm tabular-nums text-white/70">
            <span>{formatCurrency(r.spent)} of</span>
            <span className="text-white/55">$</span>
            <input
              type="number" inputMode="decimal" min={0} step={5} placeholder="target"
              aria-label={`${r.category} monthly target`}
              value={drafts[r.category] ?? (r.monthly > 0 ? String(r.monthly) : '')}
              onChange={(e) => setDrafts((d) => ({ ...d, [r.category]: e.target.value }))}
              onBlur={() => commit(r.category, r.monthly)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              className="min-h-11 w-24 rounded-lg border border-white/15 bg-black/40 px-2 text-right text-white outline-none focus:border-cyan-400/60"
            />
          </div>
        </div>
        {r.target > 0 && (
          <div className="relative mt-3 h-2.5 w-full overflow-visible rounded-full bg-white/10" role="progressbar" aria-label={`${r.category} spending this month`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${pct}% of ${formatCurrency(r.target)} spent`}>
            <div className={cn('h-full rounded-full transition-[width] duration-500', STATUS_BAR[r.status])} style={{ width: `${pct}%` }} />
            <span className="absolute -top-1 h-[18px] w-0.5 rounded bg-white/80" style={{ left: `${Math.round(r.pacePct * 100)}%` }} title="Where you would be if you spent evenly through the month" aria-hidden="true" />
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-white/70">
          <span>{detail(r)}{r.carry > 0 ? ` · includes ${formatCurrency(r.carry)} carried over` : ''}</span>
          <span className="flex flex-wrap items-center gap-2">
            {r.suggested !== null && (
              <button type="button" onClick={() => setCategoryBudget(r.category, { monthly: r.suggested as number })} className="min-h-9 rounded-full border border-cyan-300/40 px-3 font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/10">
                Set to {formatCurrency(r.suggested)} (from your history)
              </button>
            )}
            {r.monthly > 0 && (
              <label className="flex min-h-9 cursor-pointer items-center gap-1.5">
                <input type="checkbox" className="h-4 w-4 accent-cyan-400 [color-scheme:dark]" checked={r.rollover} onChange={(e) => setCategoryBudget(r.category, { rollover: e.target.checked })} />
                Carry unspent forward
              </label>
            )}
          </span>
        </div>
        {trim && <p className="mt-1 text-xs text-white/55">Trim 10% and you free up {formatCurrency(trim.perMonth)} a month, {formatCurrency(trim.perYear)} a year.</p>}
      </li>
    )
  }

  return (
    <StatCard label="Category Budgets" glow="purple" tilt={false} tooltip="A monthly target for each spending category, with live progress. The white tick on each bar is where you would be if you spent evenly through the month.">
      <div className="mt-3 text-sm text-white/70" aria-live="polite">
        {budgeted.length > 0
          ? <>You have spent <strong className="text-white">{formatCurrency(totalSpent)}</strong> of <strong className="text-white">{formatCurrency(totalTarget)}</strong> budgeted · day {day} of {dim}</>
          : <span className="flex items-center gap-2"><Target className="h-4 w-4 text-cyan-300" aria-hidden="true" /> Pick a category and type a monthly target. Rollover is off until you switch it on.</span>}
      </div>
      {(toApply.length > 0 || applied !== null) && (
        <div className="mt-3 flex flex-wrap items-center gap-3" aria-live="polite">
          {toApply.length > 0 && (
            <button type="button" onClick={applyAll} className="min-h-11 rounded-full border border-cyan-300/40 px-4 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/10">
              Set {toApply.length} {toApply.length === 1 ? 'target' : 'targets'} from my history
            </button>
          )}
          {applied !== null && toApply.length === 0 && <span className="text-sm text-white/70">Set {applied} {applied === 1 ? 'target' : 'targets'} from last month. Change or clear any of them below.</span>}
        </div>
      )}
      <ul className="mt-4 space-y-3">
        {active.map(renderRow)}
        {visibleIdle.map(renderRow)}
      </ul>
      {active.length > 0 && idle.length > 0 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="mt-3 min-h-11 text-sm font-semibold text-cyan-300 transition-colors hover:text-cyan-200">
          {showAll ? 'Show fewer categories' : `Show ${idle.length} more categories`}
        </button>
      )}
    </StatCard>
  )
}
