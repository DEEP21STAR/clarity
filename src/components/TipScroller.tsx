import { useEffect, useRef, useState } from 'react'
import { CalendarClock, Flame, TrendingUp, TrendingDown, Sparkles } from 'lucide-react'
import { cn, formatCurrency, formatShortDate } from '@/lib/utils'

export interface Tip {
  icon: typeof CalendarClock
  text: string
  tone: 'cyan' | 'amber' | 'rose' | 'success'
}

const TONE_STYLE: Record<Tip['tone'], string> = {
  cyan: 'border-cyan-400/25 bg-cyan-400/5 text-cyan-200',
  amber: 'border-amber-400/25 bg-amber-400/5 text-amber-200',
  rose: 'border-rose-400/25 bg-rose-400/5 text-rose-200',
  success: 'border-emerald-400/25 bg-emerald-400/5 text-emerald-200',
}

/**
 * 2026-09-23 — "left to right scroller on the mobile app... with tips for upcoming payments"
 * (Deep). Mobile-only (md:hidden), real horizontal scroll-snap (native touch swipe works for
 * free, not a hand-rolled drag handler) plus a slow auto-advance so it's not static even
 * before anyone touches it. Every tip here is computed from real state upstream (see the
 * buildTips helper exported alongside this component) — never placeholder copy.
 */
export function TipScroller({ tips }: { tips: Tip[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (tips.length <= 1) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % tips.length)
    }, 4500)
    return () => window.clearInterval(id)
  }, [tips.length])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const card = track.children[active] as HTMLElement | undefined
    card?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [active])

  if (tips.length === 0) return null

  return (
    <div className="md:hidden -mx-4 px-4">
      <div
        ref={trackRef}
        onScroll={(e) => {
          const track = e.currentTarget
          const idx = Math.round(track.scrollLeft / (track.firstElementChild as HTMLElement)?.offsetWidth || 0)
          if (idx !== active && idx >= 0 && idx < tips.length) setActive(idx)
        }}
        className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {tips.map((tip, i) => {
          const Icon = tip.icon
          return (
            <div
              key={i}
              className={cn('shrink-0 w-[85vw] max-w-sm snap-center rounded-xl border px-3.5 py-2.5 flex items-center gap-2.5', TONE_STYLE[tip.tone])}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-xs leading-snug">{tip.text}</span>
            </div>
          )
        })}
      </div>
      {tips.length > 1 && (
        <div className="flex items-center justify-center gap-1 mt-1.5">
          {tips.map((_, i) => (
            <div key={i} className={cn('h-1 rounded-full transition-all', i === active ? 'w-4 bg-cyan-400' : 'w-1 bg-white/15')} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Builds real tips from real state — soonest bill due, a category over/near its guide, and the
 * current streak. Returns at most 3 (the ones that are actually true), never invented filler. */
export function buildTips(params: {
  soonestBill: { name: string; amount: number; due: string } | null
  categoryOver: { label: string; amount: number } | null
  categoryClose: { label: string } | null
  streak: number
}): Tip[] {
  const tips: Tip[] = []
  if (params.soonestBill) {
    tips.push({
      icon: CalendarClock,
      text: `${params.soonestBill.name} — ${formatCurrency(params.soonestBill.amount)} due ${formatShortDate(params.soonestBill.due)}`,
      tone: 'cyan',
    })
  }
  if (params.categoryOver) {
    tips.push({ icon: TrendingUp, text: `${params.categoryOver.label} is ${formatCurrency(params.categoryOver.amount)} over its guide`, tone: 'rose' })
  } else if (params.categoryClose) {
    tips.push({ icon: TrendingDown, text: `${params.categoryClose.label} is close to its guide — worth a check`, tone: 'amber' })
  }
  if (params.streak > 0) {
    tips.push({ icon: Flame, text: `${params.streak}-day streak staying on pace — keep it going`, tone: 'success' })
  }
  if (tips.length === 0) {
    tips.push({ icon: Sparkles, text: 'All clear — nothing due soon and every category is on track', tone: 'success' })
  }
  return tips
}
