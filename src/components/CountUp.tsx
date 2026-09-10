import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

interface CountUpProps {
  value: number
  prefix?: string
  decimals?: number
  className?: string
  duration?: number
}

/**
 * Animated count-up number, used consistently across every tab's stat
 * readouts. Any real change to `value` (not the initial mount, which already
 * gets its own count-up-from-zero arrival) also gives the number a brief
 * "heartbeat" scale pulse via the `.value-pulse` CSS class — this is what
 * makes Live Funds Available, Net Worth, and every other live figure in the
 * app visibly breathe when the underlying number actually changes, not on
 * every render.
 */
export function CountUp({ value, prefix = '', decimals = 2, className, duration = 1.1 }: CountUpProps) {
  const [display, setDisplay] = useState(0)
  const [pulseKey, setPulseKey] = useState(0)
  const prevValue = useRef(0)
  const hasMounted = useRef(false)

  useEffect(() => {
    const obj = { v: prevValue.current }
    const tween = gsap.to(obj, {
      v: value,
      duration,
      ease: 'power2.out',
      onUpdate: () => setDisplay(obj.v),
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
  return (
    <span key={pulseKey} className={pulseKey > 0 ? 'value-pulse' : undefined}>
      <span className={className}>
        {sign}{prefix}{Math.abs(display).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      </span>
    </span>
  )
}
