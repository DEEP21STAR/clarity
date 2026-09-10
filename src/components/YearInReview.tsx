import { useMemo } from 'react'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { buildYearInReview } from '@/lib/logic'
import { todayIso } from '@/lib/utils'
import { Flame, Target, TrendingUp, Receipt } from 'lucide-react'

/**
 * #44, Round 20 — "financial year in review," Spotify-Wrapped-style: a few
 * big real stat tiles from the last rolling 365 days, not invented. Rolling
 * window rather than a specific NZ/AU fiscal year (see buildYearInReview()
 * doc comment in logic.ts for why).
 */
export function YearInReview() {
  const { state } = useStore()
  const review = useMemo(
    () => buildYearInReview({
      paymentRecords: state.paymentRecords,
      netWorthHistory: state.netWorthHistory,
      streak: state.streak,
      savingsGoals: state.savingsGoals,
      todayIso: todayIso(),
    }),
    [state.paymentRecords, state.netWorthHistory, state.streak, state.savingsGoals]
  )

  return (
    <StatCard label="Year in Review" glow="pink" tooltip="Real stats from the last rolling 365 days — not a specific NZ/AU fiscal year, since that wasn't specified.">
      <p className="mt-4 text-xs text-white/40">The last 12 months, for real.</p>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <Receipt className="w-4 h-4 text-cyan-300 mb-1" />
          <div className="text-xl font-bold tabular-nums text-cyan-300"><CountUp value={review.totalPaid} prefix="$" /></div>
          <p className="text-[10px] text-white/40">paid across {review.paymentCount} recorded payment{review.paymentCount === 1 ? '' : 's'}</p>
        </div>
        <div>
          <TrendingUp className="w-4 h-4 text-emerald-300 mb-1" />
          <div className={`text-xl font-bold tabular-nums ${review.netWorthChange === null ? 'text-white/30' : review.netWorthChange >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {review.netWorthChange === null ? '—' : <><span>{review.netWorthChange >= 0 ? '+' : ''}</span><CountUp value={review.netWorthChange} prefix="$" /></>}
          </div>
          <p className="text-[10px] text-white/40">{review.netWorthChange === null ? 'not enough history yet' : 'net worth change'}</p>
        </div>
        <div>
          <Flame className="w-4 h-4 text-amber-300 mb-1" />
          <div className="text-xl font-bold tabular-nums text-amber-300"><CountUp value={review.bestStreak} decimals={0} /></div>
          <p className="text-[10px] text-white/40">best on-pace streak (days)</p>
        </div>
        <div>
          <Target className="w-4 h-4 text-purple-300 mb-1" />
          <div className="text-xl font-bold tabular-nums text-purple-300">{review.goalsCompleted}/{review.goalsTotal}</div>
          <p className="text-[10px] text-white/40">savings goals completed</p>
        </div>
      </div>
    </StatCard>
  )
}
