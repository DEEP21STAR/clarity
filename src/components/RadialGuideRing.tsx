import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { cn } from '@/lib/utils'

const SIZE = 56
const STROKE = 6
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * 2026-09-23 — "radial guide rings" (from the polish table). Same real SVG-ring technique
 * already proven in PeriodicBillGauge.tsx (RADIUS/CIRCUMFERENCE/strokeDashoffset + GSAP
 * animate-in) — a new, smaller instance of an existing pattern, not a new one. Deliberately
 * kept as a DISPLAY alongside the existing % allocation slider, not a replacement for it — the
 * slider is a real input control (drag to change the guide split), the ring is read-only
 * status (how much of that guide is spent); collapsing them into one control would lose the
 * ability to adjust the split.
 */
export function RadialGuideRing({ pct, over, gradientId, colors }: { pct: number; over: boolean; gradientId: string; colors: [string, string] }) {
  const clamped = Math.min(100, Math.max(0, pct))
  const dashOffset = CIRCUMFERENCE * (1 - clamped / 100)
  const ringRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    if (!ringRef.current) return
    gsap.to(ringRef.current, { strokeDashoffset: dashOffset, duration: 0.8, ease: 'power2.out' })
  }, [dashOffset])

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90 shrink-0">
      <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE} />
      <circle
        ref={ringRef}
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke={over ? '#f43f5e' : `url(#${gradientId})`}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE}
        className={cn(over && 'transition-colors duration-300')}
      />
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
      </defs>
    </svg>
  )
}
