import type { Transaction } from './types'
import { monthOf, type CategoryBudgets } from './categoryBudgets'

/**
 * "Since you were last here": plain facts worked out from the transactions and category budgets, nothing estimated.
 * It only says things it can prove from dates: how many transactions fall after your last visit, what went out and came in,
 * and which category targets were passed in that time (found by replaying each category's spend day by day this month).
 */
export interface SinceItem { kind: 'activity' | 'budget'; text: string; tone: 'info' | 'warn' | 'good' }
export interface SinceSummary { items: SinceItem[]; daysAway: number }

const money = (n: number) => '$' + Math.abs(n).toLocaleString('en-NZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const isIso = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s)
const dayNumber = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000) }
const weekday = (iso: string) => new Date(iso.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-NZ', { weekday: 'long', timeZone: 'UTC' })

export function buildSinceLastVisit(args: { transactions: readonly Transaction[]; budgets: CategoryBudgets; lastVisitIso: string | null; todayIso: string }): SinceSummary {
  const { budgets, lastVisitIso, todayIso } = args
  const empty: SinceSummary = { items: [], daysAway: 0 }
  if (!lastVisitIso || !isIso(lastVisitIso) || !isIso(todayIso)) return empty
  const daysAway = dayNumber(todayIso) - dayNumber(lastVisitIso)
  if (daysAway < 1) return empty
  const txs = args.transactions.filter((t) => t && isIso(t.date) && typeof t.amount === 'number' && Number.isFinite(t.amount))
  const since = txs.filter((t) => t.date.slice(0, 10) > lastVisitIso.slice(0, 10) && t.date.slice(0, 10) <= todayIso.slice(0, 10))
  const items: SinceItem[] = []

  if (since.length > 0) {
    const out = since.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0)
    const inn = since.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
    const parts = [out > 0 ? `${money(out)} spent` : '', inn > 0 ? `${money(inn)} in` : ''].filter(Boolean).join(', ')
    items.push({ kind: 'activity', tone: 'info', text: `${since.length} new ${since.length === 1 ? 'transaction' : 'transactions'} since ${weekday(lastVisitIso)}${parts ? `: ${parts}` : ''}` })
  }

  // Targets passed since the last visit: this month only (a target is monthly), replayed by day.
  const month = monthOf(todayIso)
  for (const [category, b] of Object.entries(budgets ?? {})) {
    if (!b || !(b.monthly > 0)) continue
    const spend = txs.filter((t) => t.amount < 0 && t.category === category && monthOf(t.date) === month)
    const through = (iso: string) => spend.filter((t) => t.date.slice(0, 10) <= iso.slice(0, 10)).reduce((s, t) => s - t.amount, 0)
    // rollover is left out on purpose: the plain monthly target is what "passed" means here
    const before = through(lastVisitIso), now = through(todayIso)
    if (before <= b.monthly && now > b.monthly) items.push({ kind: 'budget', tone: 'warn', text: `${category} went over its ${money(b.monthly)} target` })
    else if (before < b.monthly * 0.9 && now >= b.monthly * 0.9 && now <= b.monthly) items.push({ kind: 'budget', tone: 'warn', text: `${category} is at ${Math.round((now / b.monthly) * 100)}% of its ${money(b.monthly)} target` })
  }
  return { items: items.slice(0, 4), daysAway }
}
