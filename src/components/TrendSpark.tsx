import { useId, useMemo } from 'react'

/**
 * Six-month spend line for one category: draws itself in once, the current month is a dot. Needs at least two months with spend to
 * say anything, otherwise the caller shows nothing. The numbers are also given as text in `label`, so it is not colour or shape only.
 */
export function TrendSpark({ values, label, tone = 'ok' }: { values: number[]; label: string; tone?: 'ok' | 'watch' | 'over' | 'unset' }) {
  const id = useId()
  const w = 120, h = 32, pad = 4
  const geo = useMemo(() => {
    const max = Math.max(...values, 1)
    const pts = values.map((v, i) => [pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2), pad + (1 - v / max) * (h - pad * 2)] as const)
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
    const last = pts[pts.length - 1]
    return { line, area: `${line} L${last[0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`, last }
  }, [values])
  if (values.length < 2) return null
  const color = tone === 'over' ? '#fda4af' : tone === 'watch' ? '#fcd34d' : '#6ee7b7'
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${w} ${h}`} className="trend-spark h-8 w-[120px] shrink-0 overflow-visible">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={geo.area} fill={`url(#${id}-g)`} className="trend-spark-area" />
      <path d={geo.line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="trend-spark-line" />
      <circle cx={geo.last[0]} cy={geo.last[1]} r="3" fill={color} className="trend-spark-dot" />
    </svg>
  )
}
