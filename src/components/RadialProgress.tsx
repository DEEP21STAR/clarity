import { useEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { cn, prefersReducedMotion } from '@/lib/utils'

/**
 * Coordinator follow-up — real circular/radial progress rings (not just the existing linear
 * bars), genuine eye candy: real SVG arc (stroke-dasharray/dashoffset), animated with GSAP —
 * fills from empty on first mount, and on every SUBSEQUENT re-render (a live payment landing)
 * eases smoothly from its CURRENT position to the new one rather than snapping — same pattern
 * PeriodicBillGauge.tsx already established for its own ring, generalised here so every ring
 * in the app (installment plans, device repayments, min-payment, the aggregate debt-payoff
 * ring) shares one real, tested implementation instead of four near-duplicates.
 */
export function RadialProgress({
  percent,
  color,
  size = 100,
  strokeWidth = 8,
  centerLabel,
  className,
}: {
  /** 0-100. Values outside that range are clamped — a ring never overflows past a full circle or reverses. */
  percent: number
  /** Any real CSS colour (hex/rgb) — the ring's own colour communicates status (risk-state colours), not a fixed palette. */
  color: string
  size?: number
  strokeWidth?: number
  centerLabel?: ReactNode
  className?: string
}) {
  const clamped = Math.max(0, Math.min(100, percent))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - clamped / 100)

  const ringRef = useRef<SVGCircleElement>(null)
  const hasMounted = useRef(false)

  useEffect(() => {
    const el = ringRef.current
    if (!el) return
    if (prefersReducedMotion()) {
      gsap.set(el, { strokeDashoffset: dashOffset })
      hasMounted.current = true
      return
    }
    if (!hasMounted.current) {
      // First paint: fill from genuinely empty, not just appear at the final value.
      gsap.fromTo(el, { strokeDashoffset: circumference }, { strokeDashoffset: dashOffset, duration: 1.1, ease: 'power2.out' })
      hasMounted.current = true
    } else {
      // A real update (e.g. a payment landing) — eases from wherever the ring currently sits,
      // not a fresh fromTo, so it visibly GROWS rather than resetting and refilling.
      gsap.to(el, { strokeDashoffset: dashOffset, duration: 0.9, ease: 'power2.out' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashOffset])

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
        <circle
          ref={ringRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
        />
      </svg>
      {centerLabel && <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">{centerLabel}</div>}
    </div>
  )
}
