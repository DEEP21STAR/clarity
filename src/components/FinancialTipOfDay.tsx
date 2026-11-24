import { useLayoutEffect, useRef, useState } from 'react'
import { Lightbulb, X } from 'lucide-react'
import { todayIso } from '@/lib/utils'

/**
 * Round 21, item #8 — a real financial tip of the day. Deterministic by calendar date (same
 * tip all day, same tip if reloaded, different tip tomorrow), not random on every render — a
 * simple day-of-year hash into a fixed curated list, genuinely NZ/AU-specific where relevant
 * rather than generic filler advice. Dismissing today's tip only hides TODAY's — tomorrow's
 * (different) tip isn't pre-emptively dismissed, since the dismiss key includes the date.
 */
const TIPS: string[] = [
  'NZ KiwiSaver: contributing at least 3% unlocks the full employer match — leaving it on the table is leaving real money unclaimed.',
  'AU: the ATO lets you claim a fixed 70c/hour work-from-home rate with minimal record-keeping, or the actual-cost method if it works out higher — check which wins for your setup once a year.',
  'A "sinking fund" (setting aside a little every payday for an irregular annual cost like car rego or Christmas) turns one big shock into many small, boring, forgettable transfers.',
  'Avalanche beats snowball on pure interest saved — but if a small win keeps you motivated, the "wrong" order that you actually stick to beats the "right" order you abandon in month two.',
  'NZ: ACC earner levy is compulsory and already deducted at source — if a payslip looks light, that levy plus PAYE is usually why, not an error.',
  'A rate that looks flat (e.g. "0% for 12 months") on a store installment plan often reverts to a much higher deferred rate on any leftover balance after the period — check the exact expiry date, not just the headline rate.',
  'Round-up savings (rounding every purchase up to the next $5/$10 and sinking the difference) is a real, low-friction way to save without changing any spending behaviour at all.',
  'AU: the Low Income Tax Offset (LITO) phases out as income rises — a pay rise can sometimes shrink your net gain more than the headline tax bracket alone suggests.',
  'An emergency fund covering 3-6 months of fixed bills is the standard benchmark — but even 1 month is a real, meaningful buffer against the most common shock (a large unexpected bill), so "not full yet" is still worth having.',
  'Reviewing recurring subscriptions once a quarter (not just when a card gets declined) catches the ones that quietly outlived their usefulness months ago.',
  'NZ GST is a flat 15% built into most advertised prices already — when comparing an "ex GST" business quote to a personal one, remember to add it before comparing like-for-like.',
  'Paying a card balance to $0 the same day it posts (rather than waiting for the statement due date) costs nothing extra and removes any risk of a forgotten due date ever mattering.',
]

/** Tips prefixed "NZ:" or "AU:" only show for that country; unprefixed tips are for everyone. */
export function tipsForCountry(country: 'NZ' | 'AU', tips: readonly string[] = TIPS): string[] {
  const other = country === 'NZ' ? 'AU:' : 'NZ:'
  return tips.filter((t) => !t.startsWith(other))
}

export function FinancialTipOfDay({ country = 'NZ' }: { country?: 'NZ' | 'AU' }) {
  const today = todayIso()
  const dayOfYear = Math.floor((new Date(today + 'T00:00:00Z').getTime() - new Date(today.slice(0, 4) + '-01-01T00:00:00Z').getTime()) / 86400000)
  const pool = tipsForCountry(country)
  const tip = pool[((dayOfYear % pool.length) + pool.length) % pool.length]
  const dismissKey = `clarity:tip-dismissed:${today}`

  // On a phone the tip is two lines until you ask for the rest, so the first real card stays near the top of the screen.
  const [expanded, setExpanded] = useState(false)
  const [clamped, setClamped] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)
  // the toggle only appears when the text really is cut off (a short tip needs no "Show more")
  useLayoutEffect(() => {
    const el = textRef.current
    if (el && !expanded) setClamped(el.scrollHeight > el.clientHeight + 1)
  }, [expanded, tip])
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(dismissKey) === '1' } catch { return false }
  })

  if (dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try { localStorage.setItem(dismissKey, '1') } catch { /* not persisted, still hides for this session */ }
  }

  return (
    <div className="result-reveal flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm" data-testid="tip-of-day">
      <Lightbulb className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p ref={textRef} className={expanded ? 'text-white/70 leading-snug' : 'text-white/70 leading-snug max-sm:line-clamp-2'} data-testid="tip-text">{tip}</p>
        {(clamped || expanded) && <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="sm:hidden mt-1 flex min-h-11 items-center text-xs font-semibold text-cyan-300">
          {expanded ? 'Show less' : 'Show more'}
        </button>}
      </div>
      <button onClick={dismiss} title="Dismiss today's tip" aria-label="Dismiss today's tip" className="-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-white/55 hover:text-white/80">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
