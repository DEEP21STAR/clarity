import { useEffect, useRef, useState } from 'react'

/**
 * True for `ms` milliseconds after `status` changes (never on first render). Used to give a number one soft glow when its meaning
 * changes, for example free-to-spend crossing from positive to overspent. Reduced motion is handled in CSS, not here.
 */
export function useStatusPulse(status: string | boolean, ms = 1100): boolean {
  const [pulsing, setPulsing] = useState(false)
  const first = useRef(true)
  const prev = useRef(status)
  useEffect(() => {
    if (first.current) { first.current = false; prev.current = status; return }
    if (prev.current === status) return
    prev.current = status
    setPulsing(true)
    const t = setTimeout(() => setPulsing(false), ms)
    return () => clearTimeout(t)
  }, [status, ms])
  return pulsing
}
