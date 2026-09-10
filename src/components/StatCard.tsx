import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
// html2canvas-pro — see thumbnailCache.ts's comment: plain html2canvas can't parse Tailwind
// v4's oklch colors at all, confirmed via a real failed capture, not assumed.
import html2canvas from 'html2canvas-pro'
import { cn, prefersReducedMotion } from '@/lib/utils'
import { Info, Camera, Check } from 'lucide-react'

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
  /** Round 21, item #5 — shows a small camera button that copies a real snapshot of this card to the clipboard (not a download — see the doc comment below on why). */
  copyable?: boolean
}

/**
 * Shared cinematic card: bordered panel, cut-in top-border label, colour-owned glow, GSAP
 * entrance, optional 3D tilt, hover-lift + chasing-light border, optional info tooltip,
 * focus-mode aware, optional "copy as image" button.
 *
 * The copy button writes a PNG to the clipboard via the Clipboard API rather than triggering
 * a file download — this app is published as a claude.ai Artifact, and the viewer sandbox has
 * already been confirmed (see DataExportPanel.tsx / downloads.ts) to silently swallow any
 * `<a download>` or script-driven save. A user-gesture-triggered `navigator.clipboard.write`
 * isn't a download at all, so it isn't affected — Deep pastes the result straight into Slack,
 * an email, or a note.
 */
export function StatCard({ label, glow = 'cyan', tilt = true, className, children, delay = 0, tooltip, copyable }: StatCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const c = GLOW_MAP[glow]
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')

  const copyAsImage = async () => {
    if (!ref.current || copyState === 'copying') return
    setCopyState('copying')
    try {
      const canvas = await html2canvas(ref.current, {
        backgroundColor: '#0b0d14',
        scale: 2,
        logging: false,
        // The copy button itself shouldn't appear in the copied image of its own card.
        ignoreElements: (node) => node.hasAttribute?.('data-copy-btn') ?? false,
        // Same real bug as thumbnailCache.ts: every card lives inside <main class="page-enter">,
        // whose `transform-style: preserve-3d` (paired with an ancestor's `perspective`) made
        // html2canvas-pro paint a totally blank canvas — confirmed live, not assumed. Stripped
        // only on the throwaway clone this renders from; the live page is untouched.
        onclone: (clonedDoc: Document) => {
          clonedDoc.querySelectorAll('.page-enter').forEach((n) => n.classList.remove('page-enter'))
          // Same gradient-text gap as thumbnailCache.ts — flat cyan fallback on the clone only.
          clonedDoc.querySelectorAll<HTMLElement>('.gradient-heading').forEach((n) => {
            n.style.background = 'none'
            n.style.setProperty('-webkit-text-fill-color', '#67e8f9')
            n.style.color = '#67e8f9'
          })
        },
      })
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('no blob')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopyState('copied')
    } catch {
      setCopyState('error')
    } finally {
      setTimeout(() => setCopyState('idle'), 2000)
    }
  }

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
      {copyable && (
        <button
          data-copy-btn
          onClick={copyAsImage}
          title={copyState === 'error' ? 'Copy failed — clipboard image write may be blocked in this view' : 'Copy this card as an image'}
          className="absolute top-3 right-3 z-20 w-6 h-6 rounded-md flex items-center justify-center text-white/30 hover:text-cyan-300 hover:bg-white/5 transition-colors"
        >
          {copyState === 'copied' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Camera className={cn('w-3.5 h-3.5', copyState === 'copying' && 'animate-pulse')} />}
        </button>
      )}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export { GLOW_MAP }
