import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

interface CountUpProps {
  value: number
  prefix?: string
  decimals?: number
  className?: string
  duration?: number
}

/** Animated count-up number, used consistently across every tab's stat readouts. */
export function CountUp({ value, prefix = '', decimals = 2, className, duration = 1.1 }: CountUpProps) {
  const [display, setDisplay] = useState(0)
  const prevValue = useRef(0)

  useEffect(() => {
    const obj = { v: prevValue.current }
    const tween = gsap.to(obj, {
      v: value,
      duration,
      ease: 'power2.out',
      onUpdate: () => setDisplay(obj.v),
    })
    prevValue.current = value
    return () => { tween.kill() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const sign = display < 0 ? '-' : ''
  return (
    <span className={className}>
      {sign}{prefix}{Math.abs(display).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  )
}
