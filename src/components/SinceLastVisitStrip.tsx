import { useMemo, useState } from 'react'
import { History, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { buildSinceLastVisit } from '@/lib/sinceLastVisit'
import { cn, todayIso } from '@/lib/utils'

const LAST_KEY = 'clarity-last-visit'
const BASE_KEY = 'clarity-visit-base'
const DISMISS_KEY = 'clarity-visit-dismissed'

/**
 * The day you were last here, held steady for this whole browser session (so moving between screens does not make it vanish), and today's
 * date saved for next time. Browser storage can be blocked, so every read and write is guarded and the strip simply stays hidden if it is.
 */
function readBaseline(today: string): string | null {
  try {
    const held = sessionStorage.getItem(BASE_KEY)
    if (held !== null) return held || null
    const prev = localStorage.getItem(LAST_KEY)
    sessionStorage.setItem(BASE_KEY, prev ?? '')
    localStorage.setItem(LAST_KEY, today)
    return prev
  } catch { return null }
}

/** "Since you were last here": new transactions and targets passed, a few plain lines. Shown only when you have been away at least a day. */
export function SinceLastVisitStrip() {
  const { state } = useStore()
  const today = todayIso()
  const [baseline] = useState(() => readBaseline(today))
  const [dismissed, setDismissed] = useState(() => { try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false } })
  const summary = useMemo(() => buildSinceLastVisit({ transactions: state.transactions, budgets: state.categoryBudgets ?? {}, lastVisitIso: baseline, todayIso: today }), [state.transactions, state.categoryBudgets, baseline, today])

  if (dismissed || summary.items.length === 0) return null
  const away = summary.daysAway === 1 ? 'yesterday' : `${summary.daysAway} days ago`
  return (
    <section aria-label="Since you were last here" data-testid="since-last-visit" className="since-strip relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 pl-5 pr-12">
      <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-purple-400 to-cyan-400" aria-hidden="true" />
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-purple-200">
        <History className="h-4 w-4" aria-hidden="true" /> Since you were last here · {away}
      </div>
      <ul className="mt-2 space-y-1.5 text-sm leading-snug text-white/80">
        {summary.items.map((it, i) => (
          <li key={i} className={cn('since-item flex items-start gap-2', it.tone === 'warn' && 'text-amber-200')} style={{ animationDelay: `${150 + i * 110}ms` }}>
            <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', it.tone === 'warn' ? 'bg-amber-300' : 'bg-cyan-300')} aria-hidden="true" />
            <span>{it.text}</span>
          </li>
        ))}
      </ul>
      <button
        type="button" aria-label="Hide this summary"
        onClick={() => { setDismissed(true); try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ } }}
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </section>
  )
}
