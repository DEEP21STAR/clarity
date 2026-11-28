import { useEffect, useState } from 'react'
import { Coffee } from 'lucide-react'
import { useStore } from '@/lib/store'
import { todayIso } from '@/lib/utils'
import { afterDismiss, afterSupport, readSupportMemory, supportPrompt, type SupportMemory } from '@/lib/supportPrompt'

const KEY = 'clarity-support-v1'
/** The one shared Buy Me a Coffee page every Whetū dashboard uses (same link as Tools > Support Clarity). */
const COFFEE_URL = 'https://buymeacoffee.com/nutryos'

const load = (): SupportMemory => { try { return readSupportMemory(localStorage.getItem(KEY)) } catch { return readSupportMemory(null) } }
const save = (m: SupportMemory) => { try { localStorage.setItem(KEY, JSON.stringify(m)) } catch { /* private window: it simply asks again next time */ } }

/**
 * A gentle, once-in-a-while thank-you ask. It only appears when nothing more useful is waiting (it is the fallback of the backup reminder),
 * after the first week, once there is real use, and never more often than the rules in lib/supportPrompt.ts.
 */
export function SupportNudgeStrip() {
  const { state } = useStore()
  const today = todayIso()
  const [memory, setMemory] = useState<SupportMemory>(load)

  // remember the day Clarity was first opened (kept on this device only)
  useEffect(() => { if (!memory.firstSeen) { const m = { ...memory, firstSeen: today }; setMemory(m); save(m) } }, [memory, today])

  const show = supportPrompt({ todayIso: today, memory, transactions: Array.isArray(state.transactions) ? state.transactions.length : 0, bills: Array.isArray(state.bills) ? state.bills.length : 0 })
  if (!show) return null
  return (
    <section aria-label="Support Clarity" data-testid="support-nudge" className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-purple-400/30 bg-purple-400/[0.07] py-1 pl-3 pr-1">
      <p className="flex min-w-0 flex-1 basis-56 items-start gap-2 py-2 text-sm leading-snug text-purple-100">
        <Coffee className="mt-0.5 h-4 w-4 shrink-0 text-purple-300" aria-hidden="true" />
        <span>If Clarity has taken some stress off your plate, a coffee pays for the hosting and keeps new features coming. No pressure.</span>
      </p>
      <span className="flex items-center">
        <a
          href={COFFEE_URL} target="_blank" rel="noopener noreferrer" aria-label="Buy me a coffee (opens in a new tab)"
          onClick={() => { const m = afterSupport(memory, today); setMemory(m); save(m) }}
          className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-purple-100 transition-colors hover:bg-white/10"
        >
          Buy me a coffee
        </a>
        <button
          type="button" aria-label="Not now"
          onClick={() => { const m = afterDismiss(memory, today); setMemory(m); save(m) }}
          className="min-h-11 rounded-full px-3 text-sm text-white/65 transition-colors hover:bg-white/10 hover:text-white"
        >
          Not now
        </button>
      </span>
    </section>
  )
}
