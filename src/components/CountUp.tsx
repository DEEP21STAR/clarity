import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { prefersReducedMotion } from '@/lib/utils'

interface CountUpProps {
  value: number
  prefix?: string
  decimals?: number
  className?: string
  duration?: number
}

/** Judgment call, not Deep's own number: a value change is a "big jump" (odometer treatment) above this relative size. */
const ODOMETER_JUMP_THRESHOLD = 0.15 // 15% relative change

/**
 * Animated count-up number, used consistently across every tab's stat
 * readouts. Any real change to `value` (not the initial mount, which already
 * gets its own count-up-from-zero arrival) also gives the number a brief
 * "heartbeat" scale pulse via the `.value-pulse` CSS class — this is what
 * makes Live Funds Available, Net Worth, and every other live figure in the
 * app visibly breathe when the underlying number actually changes, not on
 * every render.
 *
 * #16, Round 20: a genuinely LARGE jump (>=15% relative change, a judgment
 * call) additionally gets a real per-digit odometer roll-in on landing —
 * distinct from the normal smooth GSAP tween every value already gets,
 * which stays exactly as-is for small changes.
 */
export function CountUp({ value, prefix = '', decimals = 2, className, duration = 1.1 }: CountUpProps) {
  const [display, setDisplay] = useState(0)
  const [pulseKey, setPulseKey] = useState(0)
  const [odometerKey, setOdometerKey] = useState(0)
  const prevValue = useRef(0)
  const hasMounted = useRef(false)

  useEffect(() => {
    const obj = { v: prevValue.current }
    const isBigJump = hasMounted.current && prevValue.current !== 0 &&
      Math.abs((value - prevValue.current) / prevValue.current) >= ODOMETER_JUMP_THRESHOLD
    // #47 — the count-up tween is JS-driven (GSAP), invisible to CSS reduced-motion rules;
    // duration:0 still lands on the exact same real value, just without the animated climb,
    // and the odometer digit-roll never fires (its own CSS is also gated, belt-and-braces).
    const reduceMotion = prefersReducedMotion()
    const tween = gsap.to(obj, {
      v: value,
      duration: reduceMotion ? 0 : duration,
      ease: 'power2.out',
      onUpdate: () => setDisplay(obj.v),
      onComplete: () => { if (isBigJump && !reduceMotion) setOdometerKey((k) => k + 1) },
    })
    if (hasMounted.current && prevValue.current !== value) {
      setPulseKey((k) => k + 1)
    }
    hasMounted.current = true
    prevValue.current = value
    return () => { tween.kill() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const sign = display < 0 ? '-' : ''
  // #51 — explicit locale (not the viewer's ambient one, which can silently mismatch the
  // "$" prefix with comma-decimal formatting on a non-English system)
  const formatted = Math.abs(display).toLocaleString('en-NZ', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

  return (
    <span key={pulseKey} className={pulseKey > 0 ? 'value-pulse' : undefined}>
      <span className={className}>
        {sign}{prefix}
        {odometerKey > 0 ? (
          <span key={odometerKey} aria-label={formatted}>
            {formatted.split('').map((ch, i) =>
              /\d/.test(ch) ? (
                <span key={i} className="odometer-digit">
                  <span className="odometer-digit-inner" style={{ animationDelay: `${i * 0.03}s` }}>{ch}</span>
                </span>
              ) : (
                <span key={i}>{ch}</span>
              )
            )}
          </span>
        ) : (
          formatted
        )}
      </span>
    </span>
  )
}
