import { useState } from 'react'
import { ChevronRight, Sparkles } from 'lucide-react'
import { useStore } from '@/lib/store'
import { RELEASE, shouldShowWhatsNew } from '@/lib/whatsNew'

const SEEN_KEY = 'clarity-whatsnew-seen'

function readSeen(): string | null { try { return localStorage.getItem(SEEN_KEY) } catch { return null } }

/** True when the "What's new" card should be the notice on screen. */
export function useWhatsNew() {
  const { state } = useStore()
  const [seen, setSeen] = useState<string | null>(readSeen)
  const visible = shouldShowWhatsNew({
    seenId: seen, releaseId: RELEASE.id,
    transactionCount: Array.isArray(state.transactions) ? state.transactions.length : 0,
    historyDays: Array.isArray(state.netWorthHistory) ? state.netWorthHistory.length : 0,
  })
  const dismiss = () => { setSeen(RELEASE.id); try { localStorage.setItem(SEEN_KEY, RELEASE.id) } catch { /* ignore */ } }
  return { visible, dismiss }
}

export function WhatsNewCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section aria-label="What's new" data-testid="whats-new" className="relative overflow-hidden rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.05] py-2 pl-5 pr-3">
      <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-cyan-300 to-purple-400" aria-hidden="true" />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-cyan-200">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> What's new
        </div>
        <button type="button" onClick={onDismiss} className="min-h-11 rounded-full px-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white">
          Got it
        </button>
      </div>
      <ul className="text-sm leading-snug text-white/85 md:grid md:grid-cols-2 md:gap-x-6">
        {RELEASE.items.map((it, i) => (
          <li key={i}>
            {it.tab ? (
              <button type="button" aria-label={`${it.text}: open ${it.tabLabel}`} onClick={() => window.dispatchEvent(new CustomEvent('clarity:goto-tab', { detail: it.tab }))} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-1 text-left transition-colors hover:bg-white/5">
                <span>{it.text}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-cyan-200" aria-hidden="true" />
              </button>
            ) : (
              <p className="flex min-h-11 items-center px-1">{it.text}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
