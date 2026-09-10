import { useMemo } from 'react'
import { useStore } from '@/lib/store'
import { buildInsightsTicker, type TickerItem, type DueSeverity } from '@/lib/logic'
import { todayIso } from '@/lib/utils'
import { CalendarClock, TrendingUp, Flame, AlertTriangle, Sparkles } from 'lucide-react'

/** Per-insight-type icon + colour — real variety, not one generic dot for every message. */
const TICKER_ICON: Record<TickerItem['type'], typeof CalendarClock> = {
  bill: CalendarClock,
  health: TrendingUp,
  streak: Flame,
  price: AlertTriangle,
  default: Sparkles,
}

const SEVERITY_COLOR: Record<DueSeverity, string> = {
  ok: 'text-emerald-300',
  warn: 'text-amber-300',
  danger: 'text-rose-300',
}

const TYPE_COLOR: Record<TickerItem['type'], string> = {
  bill: 'text-cyan-300',
  health: 'text-purple-300',
  streak: 'text-amber-300',
  price: 'text-rose-300',
  default: 'text-cyan-300',
}

/** Scrolling marquee of real, rotating insights pulled from the actual data model — not placeholder copy, and not one generic icon for everything. */
export function InsightsTicker() {
  const { state } = useStore()
  const items = useMemo(
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
  const loopItems = [...items, ...items]
  // Scale duration to item count so pacing feels the same whether there are 2 items or 8 —
  // fixing a real "choppy" complaint that came from a fixed 32s duration rushing longer lists.
  const durationSec = Math.max(18, items.length * 6)

  return (
    <div className="ticker-wrap glass-panel relative rounded-full border border-cyan-400/30 px-4 py-2.5 overflow-hidden shadow-[0_0_30px_-8px_rgba(34,211,238,0.5)]">
      <div className="ticker-track gap-8" style={{ animationDuration: `${durationSec}s` }}>
        {loopItems.map((item, i) => {
          const Icon = TICKER_ICON[item.type]
          const iconColor = item.type === 'bill' && item.severity ? SEVERITY_COLOR[item.severity] : TYPE_COLOR[item.type]
          return (
            <span key={i} className="flex items-center gap-2 text-xs font-medium text-white/80 whitespace-nowrap">
              <span className={`flex items-center justify-center w-5 h-5 rounded-full bg-white/5 border border-white/10 shrink-0 ${iconColor}`}>
                <Icon className="w-3 h-3" />
              </span>
              {item.text}
            </span>
          )
        })}
      </div>
    </div>
  )
}
