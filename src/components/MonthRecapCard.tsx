import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import { useStore } from '@/lib/store'
import { buildMonthRecap } from '@/lib/monthRecap'
import { formatCurrency, formatShortDate, todayIso } from '@/lib/utils'

/** "Last month in review": the on-device recap of the previous complete month. Hidden until there is a month to look back on. */
export function MonthRecapCard() {
  const { state } = useStore()
  const today = todayIso()
  const recap = useMemo(() => buildMonthRecap(state.transactions, today), [state.transactions, today])
  if (!recap) return null

  const vs = recap.vsPrevious
  const tiles: { label: string; value: string; tone?: string }[] = [
    { label: 'Spent', value: formatCurrency(recap.spent) },
    { label: 'Money in', value: formatCurrency(recap.income) },
    { label: recap.net >= 0 ? 'Left over' : 'Overspent by', value: formatCurrency(Math.abs(recap.net)), tone: recap.net >= 0 ? 'text-emerald-300' : 'text-rose-300' },
    { label: 'No-spend days', value: `${recap.noSpendDays} of ${recap.daysInMonth}` },
  ]

  return (
    <section aria-label={`${recap.monthLabel} in review`} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-purple-200">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> {recap.monthLabel} in review
        </div>
        {vs !== null && (
          <p className="text-sm text-white/70">
            {vs === 0 ? 'Same spending as the month before.' : `${formatCurrency(Math.abs(vs))} ${vs > 0 ? 'more' : 'less'} than the month before.`}
          </p>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <dt className="text-xs text-white/55">{t.label}</dt>
            <dd className={`mt-1 text-xl font-bold tabular-nums ${t.tone ?? 'text-white'}`}>{t.value}</dd>
          </div>
        ))}
      </dl>

      {recap.topCategories.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-white/85">Where it went</h3>
          <ul className="mt-2 space-y-2">
            {recap.topCategories.map((c) => (
              <li key={c.category}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-white/85">{c.category}</span>
                  <span className="tabular-nums text-white/70">{formatCurrency(c.amount)} · {Math.round(c.share * 100)}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10" role="presentation">
                  <div className="h-full rounded-full bg-gradient-to-r from-purple-400 to-cyan-400" style={{ width: `${Math.max(2, Math.round(c.share * 100))}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="mt-4 space-y-1 text-sm leading-snug text-white/70">
        {recap.busiestDay && <li>Busiest day: {formatShortDate(recap.busiestDay.date)}, {formatCurrency(recap.busiestDay.amount)}.</li>}
        {recap.biggestExpense && <li>Biggest single expense: {recap.biggestExpense.description} ({formatCurrency(recap.biggestExpense.amount)}, {formatShortDate(recap.biggestExpense.date)}).</li>}
      </ul>
    </section>
  )
}
