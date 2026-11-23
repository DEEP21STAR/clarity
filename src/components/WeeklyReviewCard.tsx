import { useMemo } from 'react'
import { CalendarCheck } from 'lucide-react'
import { useStore } from '@/lib/store'
import { computeBudgetRows } from '@/lib/categoryBudgets'
import { computeSafeToSpend } from '@/lib/safeToSpend'
import { buildWeeklyReview } from '@/lib/weeklyReview'
import { todayIso } from '@/lib/utils'

/** "Your week": a few plain sentences built from your own numbers (spend vs last week, biggest category, budgets, what is safe to spend). */
export function WeeklyReviewCard() {
  const { state } = useStore()
  const today = todayIso()
  const review = useMemo(() => {
    const rows = computeBudgetRows(state.categoryBudgets ?? {}, state.transactions, today)
    const safe = computeSafeToSpend(state, today, state.householdView)
    return buildWeeklyReview({
      transactions: state.transactions,
      todayIso: today,
      budgetRows: rows,
      dailyAllowance: safe.dailyAllowance,
      daysToPayday: safe.daysToPayday,
    })
  }, [state, today])

  return (
    <section aria-label="Your week" className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 pl-5">
      <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-cyan-400 to-purple-500" aria-hidden="true" />
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-cyan-200">
        <CalendarCheck className="h-4 w-4" aria-hidden="true" /> Your week
      </div>
      {review.hasData && <p className="mt-2 text-base font-semibold text-white/90">{review.lines[0]}</p>}
      <ul className="mt-2 space-y-1.5 text-sm leading-snug text-white/70">
        {(review.hasData ? review.lines.slice(1) : review.lines).map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    </section>
  )
}
