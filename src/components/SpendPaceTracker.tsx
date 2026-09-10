import { useEffect, useMemo } from 'react'
import { StatCard } from './StatCard'
import { useStore } from '@/lib/store'
import { calcSpendPaceAlerts, updateStreak } from '@/lib/logic'
import { formatCurrency, todayIso } from '@/lib/utils'
import { AlertTriangle, Flame, Award } from 'lucide-react'

const MILESTONE_LABEL: Record<number, string> = { 7: '7-day streak', 30: '30-day streak', 100: '100-day streak' }

// Module-level (not per-instance) guard — deliberately NOT a useRef. Round 21's
// ThumbnailPrecacher can genuinely mount a second, off-screen instance of this component
// (Upcoming Payments' tab tree, pre-warming its ⌘K preview thumbnail) at the same time the
// real visible instance exists. Two per-instance refs would both pass their own "haven't
// checked yet" guard and BOTH call the once-per-day streak-advance mutation below — a real
// double-fire race that could double-advance or miscompute the streak. A single flag shared
// by every instance on the page makes the real once-per-day check fire exactly once,
// regardless of how many components read this file mount this render.
let streakCheckedThisPageLoad = false

/**
 * Manual spend-vs-allocation tracker for Food/Fuel/Personal, the predictive
 * pace alert, and the savings streak. Since there's no real transaction feed
 * tied to these three categories, Deep enters his running spend himself —
 * the pace math and streak logic are real, the input is honestly manual.
 */
export function SpendPaceTracker({
  allocation,
  windowStart,
  windowEnd,
  onMilestone,
}: {
  allocation: { food: number; fuel: number; personal: number }
  windowStart: string
  windowEnd: string
  onMilestone: (milestone: number) => void
}) {
  const { state, updateSpendTracker, resetSpendTracker, setStreak } = useStore()
  const today = todayIso()

  const alerts = useMemo(
    () => calcSpendPaceAlerts(state.spendTracker, allocation, windowStart, windowEnd, today),
    [state.spendTracker, allocation, windowStart, windowEnd, today]
  )

  // Once-per-real-day streak check. Honest limitation: this only runs on a
  // day Deep actually opens the app (no backend to check automatically).
  // Module-level streakCheckedThisPageLoad guard (see its own comment above) — NOT a
  // per-instance useRef — so a second simultaneous mount (e.g. ThumbnailPrecacher's
  // off-screen pre-render of this same tab) can never double-fire this mutation.
  useEffect(() => {
    if (streakCheckedThisPageLoad) return
    streakCheckedThisPageLoad = true
    if (state.streak.lastCheckedDate === today) return
    const { streak, newMilestone } = updateStreak(state.streak, alerts.length === 0, today)
    setStreak(streak)
    if (newMilestone) onMilestone(newMilestone)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <StatCard label="Spend Pace & Streak" glow={alerts.length > 0 ? 'danger' : 'success'}>
      <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Flame className={`w-5 h-5 ${state.streak.current > 0 ? 'text-amber-400' : 'text-white/30'}`} />
          <span className="text-sm text-white/70">
            <span className="text-xl font-bold text-white tabular-nums">{state.streak.current}</span> day streak
            {state.streak.best > 0 && <span className="text-white/40"> · best {state.streak.best}</span>}
          </span>
          {[7, 30, 100].filter((m) => state.streak.milestonesHit.includes(m)).map((m) => (
            <span key={m} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30 streak-badge-pop">
              <Award className="w-3 h-3" /> {MILESTONE_LABEL[m]}
            </span>
          ))}
        </div>
        <button onClick={() => resetSpendTracker(today)} className="text-xs text-white/40 hover:text-white">
          Reset spend tracker
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['food', 'fuel', 'personal'] as const).map((cat) => (
          <div key={cat} className="rounded-xl border border-white/10 bg-black/30 p-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-white/60 capitalize">{cat} spent so far</label>
            <div className="mt-2 flex items-center gap-1">
              <span className="text-white/40">$</span>
              <input
                type="number" step="0.01" value={state.spendTracker[cat]}
                onChange={(e) => updateSpendTracker({ [cat]: parseFloat(e.target.value) || 0 } as any)}
                className="w-full bg-transparent text-lg font-bold tabular-nums text-white outline-none border-b border-white/10 focus:border-cyan-400/60"
              />
            </div>
            <p className="text-[11px] text-white/35 mt-1">of {formatCurrency(allocation[cat])} allocated</p>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <div className="mt-4 space-y-2">
          {alerts.map((a) => (
            <div key={a.category} className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="capitalize">{a.category}</span> is on track to run out early — {a.pctSpent.toFixed(0)}% spent vs {a.pctElapsed.toFixed(0)}% of the period elapsed.
            </div>
          ))}
        </div>
      )}
    </StatCard>
  )
}
