import { useMemo } from 'react'
import { useStore } from '@/lib/store'
import { buildInsightsTicker } from '@/lib/logic'
import { todayIso } from '@/lib/utils'
import { Sparkles } from 'lucide-react'

/** Scrolling marquee of real, rotating insights pulled from the actual data model — not placeholder copy. */
export function InsightsTicker() {
  const { state } = useStore()
  const messages = useMemo(
    () =>
      buildInsightsTicker({
        bills: state.bills,
        periodicBills: state.periodicBills,
        sinkingFunds: state.sinkingFunds,
        healthScoreHistory: state.healthScoreHistory,
        streak: state.streak,
        todayIso: todayIso(),
      }),
    [state.bills, state.periodicBills, state.sinkingFunds, state.healthScoreHistory, state.streak]
  )

  // Duplicate the list so the CSS marquee (translateX 0 -> -50%) loops seamlessly.
  const loopItems = [...messages, ...messages]

  return (
    <div className="ticker-wrap glass-panel relative rounded-full border border-cyan-400/20 px-4 py-2 overflow-hidden">
      <div className="ticker-track gap-8">
        {loopItems.map((m, i) => (
          <span key={i} className="flex items-center gap-2 text-xs text-white/70 whitespace-nowrap">
            <Sparkles className="w-3 h-3 text-cyan-300 shrink-0" />
            {m}
          </span>
        ))}
      </div>
    </div>
  )
}
