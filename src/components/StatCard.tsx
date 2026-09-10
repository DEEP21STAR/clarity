import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { cn, prefersReducedMotion } from '@/lib/utils'
import { Info } from 'lucide-react'

export type GlowColor = 'cyan' | 'purple' | 'pink' | 'amber' | 'success' | 'danger'

const GLOW_MAP: Record<GlowColor, { border: string; text: string; shadow: string; grad: string }> = {
  cyan: { border: 'border-cyan-400/30', text: 'text-cyan-300', shadow: 'shadow-[0_0_40px_-10px_rgba(34,211,238,0.45)]', grad: 'from-cyan-400 to-blue-500' },
  purple: { border: 'border-purple-400/30', text: 'text-purple-300', shadow: 'shadow-[0_0_40px_-10px_rgba(168,85,247,0.45)]', grad: 'from-purple-400 to-fuchsia-500' },
  pink: { border: 'border-pink-400/30', text: 'text-pink-300', shadow: 'shadow-[0_0_40px_-10px_rgba(236,72,153,0.45)]', grad: 'from-pink-400 to-rose-500' },
  amber: { border: 'border-amber-400/30', text: 'text-amber-300', shadow: 'shadow-[0_0_40px_-10px_rgba(245,158,11,0.45)]', grad: 'from-amber-400 to-orange-500' },
  success: { border: 'border-emerald-400/30', text: 'text-emerald-300', shadow: 'shadow-[0_0_40px_-10px_rgba(52,211,153,0.45)]', grad: 'from-cyan-400 to-emerald-400' },
  danger: { border: 'border-rose-500/40', text: 'text-rose-300', shadow: 'shadow-[0_0_40px_-10px_rgba(255,45,85,0.55)]', grad: 'from-rose-500 to-pink-600' },
}

interface StatCardProps {
  label: string
  glow?: GlowColor
  tilt?: boolean
  className?: string
  children: React.ReactNode
  delay?: number
  /** Extra one-line detail shown via a small info icon next to the label — real hover tooltip, not decorative. */
  tooltip?: string
}

/** Shared cinematic card: bordered panel, cut-in top-border label, colour-owned glow, GSAP entrance, optional 3D tilt, hover-lift + chasing-light border, optional info tooltip, focus-mode aware. */
export function StatCard({ label, glow = 'cyan', tilt = true, className, children, delay = 0, tooltip }: StatCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const c = GLOW_MAP[glow]

  useEffect(() => {
    if (!ref.current) return
    // #47 — a reduced-motion viewer still gets the card, just no fly-in/scale.
    if (prefersReducedMotion()) { gsap.set(ref.current, { opacity: 1, y: 0, scale: 1 }); return }
    gsap.fromTo(
      ref.current,
      { opacity: 0, y: 24, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.7, delay, ease: 'power3.out' }
    )
  }, [delay])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // #47 — the cursor-follow 3D tilt is the single most pervasive GSAP motion effect in the
    // app (every StatCard); CSS media queries can't reach GSAP at all, so this is a real,
    // explicit JS-level gate. Focus-mode's dim/undim (a mild opacity fade, already has its own
    // CSS reduced-motion override) stays active either way — only the tilt/lift motion is gated.
    const reduceMotion = prefersReducedMotion()
    const onMove = (e: MouseEvent) => {
      if (reduceMotion) return
      const rect = el.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width - 0.5
      const py = (e.clientY - rect.top) / rect.height - 0.5
      // Lift (translateY) lives in the SAME tween as the tilt rotation so they never fight over
      // the element's transform — tilt-disabled cards still get the lift, just no rotation.
      gsap.to(el, {
        rotateY: tilt ? px * 6 : 0,
        rotateX: tilt ? -py * 6 : 0,
        y: -4,
        duration: 0.4,
        ease: 'power2.out',
        transformPerspective: 800,
      })
    }
    const onEnter = () => document.documentElement.classList.add('focus-mode-active')
    const onLeave = () => {
      if (!reduceMotion) gsap.to(el, { rotateY: 0, rotateX: 0, y: 0, duration: 0.5, ease: 'power2.out' })
      document.documentElement.classList.remove('focus-mode-active')
    }
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseenter', onEnter)
      el.removeEventListener('mouseleave', onLeave)
      document.documentElement.classList.remove('focus-mode-active')
    }
  }, [tilt])

  return (
    <div
      ref={ref}
      className={cn(
        'label-cut glass-panel card-lift card-chase-border card-focusable relative rounded-2xl border p-5',
        c.border,
        c.shadow,
        className
      )}
      style={{ transformStyle: 'preserve-3d' }}
    >
      <div className="glass-sheen" />
      <div className={cn('absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r opacity-70', c.grad)} />
      <span className={cn('label-tab font-semibold relative z-10 inline-flex items-center gap-1', c.text)}>
        {label}
        {tooltip && (
          <span title={tooltip} className="cursor-help">
            <Info className="w-2.5 h-2.5 opacity-60" />
          </span>
        )}
      </span>
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export { GLOW_MAP }
