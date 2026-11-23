import { trendDirection, percentChange } from '@/lib/logic'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'

/**
 * #24/#45 — real trend arrow beside a stat, comparing to an ACTUAL previous
 * value (never invented). `goodDirection` flags which direction is the
 * "good" one for colouring (e.g. spend going up is bad, savings going up is
 * good) — defaults to 'up' being good.
 */
export function TrendArrow({ current, previous, goodDirection = 'up', suffix = ' vs last period' }: {
  current: number
  previous: number
  goodDirection?: 'up' | 'down'
  suffix?: string
}) {
  const dir = trendDirection(current, previous)
  const pct = percentChange(current, previous)
  if (dir === 'flat' || pct === null) {
    return (
      <span className="trend-arrow inline-flex items-center gap-1 text-[11px] text-white/40">
        <Minus className="w-3 h-3" /> flat{suffix}
      </span>
    )
  }
  const isGood = dir === goodDirection
  return (
    <span className={`trend-arrow inline-flex items-center gap-1 text-[11px] font-medium ${isGood ? 'text-emerald-300' : 'text-rose-300'}`}>
      {dir === 'up' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {Math.abs(pct).toFixed(1)}%{suffix}
    </span>
  )
}
