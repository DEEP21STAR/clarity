import { useId } from 'react'

/** Tiny inline SVG trend line (no chart library). Needs >= 2 points; caller shows the empty state. */
export function Sparkline({ values, width = 160, height = 44, label }: { values: number[]; width?: number; height?: number; label: string }) {
  const id = useId()
  if (values.length < 2) return null
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  const pad = 4
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (width - pad * 2), pad + (1 - (v - min) / span) * (height - pad * 2)])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${height} L${pts[0][0].toFixed(1)} ${height} Z`
  const last = pts[pts.length - 1]
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[200px] h-11">
      <defs>
        <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ux-accent-a)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--ux-accent-a)" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id={`${id}-s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--ux-accent-a)" />
          <stop offset="100%" stopColor="var(--ux-accent-b)" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id}-f)`} opacity="0.35" />
      <path d={line} fill="none" stroke={`url(#${id}-s)`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--ux-accent-b)" />
    </svg>
  )
}
