import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * #47, Round 20 reduced-motion audit finding: CSS `@media (prefers-reduced-
 * motion: reduce)` rules can NEVER reach GSAP-driven motion (it's JS setting
 * inline transform/style properties every frame, which always wins over any
 * stylesheet). Every GSAP effect that's genuinely motion (not just a value
 * changing) needs an explicit JS-level check like this one — used to gate
 * StatCard's cursor-follow 3D tilt and CountUp's animated tween duration,
 * the two highest-impact/most pervasive GSAP effects in the app.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * #51, Round 20: the number formatting was previously pinned to `undefined`
 * (the VIEWER'S ambient browser/OS locale) — on a non-English-formatted
 * system that silently renders e.g. "1.234,56" (comma decimal, period
 * thousands) right next to a "$" prefix that assumes English-style
 * formatting, a genuinely broken-looking mismatch. Real finding worth
 * disclosing: NZ and AU number formatting conventions are actually
 * IDENTICAL (both use comma-thousands/period-decimal) — there's no visible
 * difference to demonstrate between them. The real fix is pinning an
 * explicit `en-NZ`/`en-AU` locale instead of trusting the ambient one, so
 * formatting is always correct regardless of the viewer's own system
 * settings — tied to the existing NZ/AU country toggle via the `currency`
 * param already threaded through this function.
 */
export function formatCurrency(n: number, currency: 'NZD' | 'AUD' = 'NZD'): string {
  const symbol = currency === 'NZD' ? '$' : 'A$'
  const locale = currency === 'NZD' ? 'en-NZ' : 'en-AU'
  const sign = n < 0 ? '-' : ''
  return `${sign}${symbol}${Math.abs(n).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Today's date as YYYY-MM-DD in the VIEWER'S LOCAL calendar day — not UTC.
 * `toISOString()` converts to UTC first, which silently shifts the date
 * backward for any UTC+ timezone (e.g. NZ, UTC+12/13) whenever local time
 * is past midnight but the UTC day hasn't rolled over yet. That mismatch
 * was caught live: the Month-view income figure was off by a day's worth
 * of Fridays because of it.
 */
export function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Short real-date label ("17 Sep") for an ISO date string — parsed as a UTC
 * calendar date so it never shifts a day depending on the viewer's
 * timezone. Shared by every due-date badge in the app (DueBadge and
 * friends) — Round 20 added the real date next to the relative "due in N
 * days" label after Deep pointed out only the relative distance was shown.
 */
export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
}

/**
 * "17 Sep 2026" — same word-month convention as formatShortDate, with a year. Consolidates two
 * near-duplicate inline `toLocaleDateString('en-NZ', {...})` calls (Debts.tsx's payoff-date
 * caption, previously) that were correct in isolation but not routed through this shared file —
 * exactly the kind of drift that let a real month-first bug slip through elsewhere. See the
 * `formatNumericDate` doc comment below for the full incident.
 */
export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "September 2026" — month/year only, for the Bill Calendar's month header. */
export function formatMonthYear(year: number, month0: number): string {
  return new Date(Date.UTC(year, month0, 1)).toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })
}

/**
 * "11/09/2026" — DD/MM/YYYY, explicit 2-digit day/month so the field ORDER is never left to a
 * locale default to decide. Real bug this fixes: Deep found a date rendering as "09/11/2026"
 * (US MM/DD/YYYY) — traced to native `<input type="date">` elements, whose on-screen digit
 * display is controlled by the BROWSER's own OS/Accept-Language locale, not by this page's
 * `lang` attribute or anything JS can override (confirmed live: setting `lang="en-NZ"` on the
 * input, and on a wrapping element, changed nothing — a genuine browser-native-control
 * limitation, not a bug in our code). Every native date input in the app is paired with a
 * small read-out using THIS function right next to it, so the one thing Deep actually reads to
 * confirm what's selected is always unambiguous, regardless of what the native widget itself
 * shows. Every other date-as-TEXT surface in the app (calendar cells, due badges, payment
 * history, the accountant export) already goes through formatShortDate/formatLongDate/this
 * function — nothing left formats a date via a bare/inline `toLocaleDateString()` call.
 */
export function formatNumericDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-NZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
