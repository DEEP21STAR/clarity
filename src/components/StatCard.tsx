import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { cn } from '@/lib/utils'

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
}

/** Shared cinematic card: bordered panel, cut-in top-border label, colour-owned glow, GSAP entrance, optional 3D tilt. */
export function StatCard({ label, glow = 'cyan', tilt = true, className, children, delay = 0 }: StatCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const c = GLOW_MAP[glow]

  useEffect(() => {
    if (!ref.current) return
    gsap.fromTo(
      ref.current,
      { opacity: 0, y: 24, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.7, delay, ease: 'power3.out' }
    )
  }, [delay])

  useEffect(() => {
    const el = ref.current
    if (!el || !tilt) return
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width - 0.5
      const py = (e.clientY - rect.top) / rect.height - 0.5
      gsap.to(el, { rotateY: px * 6, rotateX: -py * 6, duration: 0.4, ease: 'power2.out', transformPerspective: 800 })
    }
    const onLeave = () => gsap.to(el, { rotateY: 0, rotateX: 0, duration: 0.5, ease: 'power2.out' })
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [tilt])

  return (
    <div
      ref={ref}
      className={cn(
        'label-cut glass-panel relative rounded-2xl border p-5',
        c.border,
        c.shadow,
        className
      )}
      style={{ transformStyle: 'preserve-3d' }}
    >
      <div className="glass-sheen" />
      <div className={cn('absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r opacity-70', c.grad)} />
      <span className={cn('label-tab font-semibold relative z-10', c.text)}>{label}</span>
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export { GLOW_MAP }
