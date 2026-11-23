import { useState } from 'react'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { X, Wallet, Receipt, Plus, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

const DISMISS_KEY = 'clarity:getting-started-dismissed'

function loadDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function saveDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch { /* noop */ }
}

/**
 * 2026-09-23 — "when the Dashboard does load it gives a reminder what to add & how" (Deep).
 * Only shows for a genuinely fresh setup — bills.length === 0 AND both tracked accounts still
 * at $0 — real signals of "nothing's been entered yet," not a guess off one coincidental
 * number (e.g. never checks grossAnnualIncome against the seed default, since a real income
 * could legitimately match it). Deep's own live account already has real bills/balances, so
 * this never shows for him day-to-day — it's specifically for what a new client sees first.
 * Dismiss is permanent (localStorage), not a snooze — this is a one-time "you're new" nudge,
 * not a recurring insight like insightSnooze.ts's 7-day pattern.
 */
export function GettingStartedCard() {
  const { state } = useStore()
  const [dismissed, setDismissed] = useState(loadDismissed)

  const hsbc = state.accounts.find((a) => a.id === 'hsbc')?.value ?? 0
  const overdraft = state.accounts.find((a) => a.id === 'overdraft')?.value ?? 0
  const isFreshSetup = state.bills.length === 0 && hsbc === 0 && overdraft === 0

  if (dismissed || !isFreshSetup) return null

  const dismiss = () => {
    saveDismissed()
    setDismissed(true)
  }

  const steps = [
    { icon: Wallet, title: 'Add your account balances', body: 'Upcoming Payments → Accounts — HSBC and Overdraft, whatever you actually have right now. Live Funds Available starts from these.' },
    { icon: Receipt, title: 'Add your recurring bills', body: 'Upcoming Payments → Bills — rent, subscriptions, insurance. Each one with an amount, how often, and roughly when it’s due.' },
    { icon: Plus, title: 'Try logging a spend', body: 'Tap the + on Food, Fuel, or Personal on Upcoming Payments — it deducts live and warns you if it’d eat into money needed for a bill.' },
    { icon: BookOpen, title: 'Stuck on anything?', body: 'Tools → Help has step-by-step guides with real screenshots for every one of these.' },
  ]

  return (
    <StatCard label="Getting Started" glow="purple" className="relative">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 z-20 w-6 h-6 rounded-md flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <p className="mt-4 text-xs text-white/45">Nothing's been added yet — here's the quickest path to a real number on this Dashboard.</p>
      <div className="mt-4 space-y-3">
        {steps.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={s.title} className={cn('flex items-start gap-3', i > 0 && 'pt-3 border-t border-white/5')}>
              <div className="w-7 h-7 rounded-lg bg-purple-400/10 border border-purple-400/25 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-3.5 h-3.5 text-purple-300" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white/85">{s.title}</p>
                <p className="text-[11px] text-white/45 mt-0.5 leading-relaxed">{s.body}</p>
              </div>
            </div>
          )
        })}
      </div>
    </StatCard>
  )
}
