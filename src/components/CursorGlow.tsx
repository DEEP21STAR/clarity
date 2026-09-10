import { useEffect, useRef } from 'react'

/**
 * #42 — custom glowing cursor-trail dot matching the neon theme. Desktop
 * only (CSS media query hides it on coarse/touch pointers and under
 * reduced-motion) and lightweight: one fixed div moved via direct style
 * writes on `mousemove`, no React re-render per pixel.
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia?.('(pointer: coarse)').matches) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current
    if (!el) return
    let visible = false
    const onMove = (e: MouseEvent) => {
      el.style.left = `${e.clientX}px`
      el.style.top = `${e.clientY}px`
      if (!visible) { el.style.opacity = '1'; visible = true }
    }
    const onLeave = () => { el.style.opacity = '0'; visible = false }
    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return <div ref={ref} className="cursor-glow-dot" style={{ opacity: 0 }} aria-hidden="true" />
}
