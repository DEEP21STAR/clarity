import type { Transaction } from './types'
import { monthOf, previousMonth, spentInMonth } from './categoryBudgets'

const round2 = (n: number) => Math.round(n * 100) / 100

/** What was spent in a category in one month on or before a given day of that month (a fair like-for-like comparison part-way through a month). */
export function spentInMonthUpTo(txs: readonly Transaction[], category: string, monthIso: string, day: number): number {
  let s = 0
  for (const t of txs) {
    if (!t || !(t.amount < 0) || t.category !== category || monthOf(t.date) !== monthIso) continue
    if ((Number(String(t.date).slice(8, 10)) || 0) <= day) s -= t.amount
  }
  return round2(s)
}

export interface CategoryTrend {
  /** Monthly spend, oldest first, ending with this month so far. Always `months` long. */
  series: number[]
  /** Months in the series that have any spend in this category. */
  monthsWithSpend: number
  /** This month so far vs last month by the same day: 0.18 = up 18%. Null when last month has no spend to compare to. */
  changeVsLast: number | null
  lastSameDay: number
}

export function categoryTrend(allTxs: readonly Transaction[], category: string, todayIso: string, months = 6): CategoryTrend {
  const txs = allTxs.filter((t) => t && typeof t === 'object')
  const month = monthOf(todayIso)
  const day = Math.max(1, Number(todayIso.slice(8, 10)) || 1)
  const keys: string[] = [month]
  for (let i = 1; i < months; i++) keys.unshift(previousMonth(keys[0]))
  const series = keys.map((k) => spentInMonth(txs, category, k))
  const lastSameDay = spentInMonthUpTo(txs, category, keys[keys.length - 2], day)
  const now = series[series.length - 1]
  return {
    series,
    monthsWithSpend: series.filter((v) => v > 0).length,
    lastSameDay,
    changeVsLast: lastSameDay > 0 ? round2((now - lastSameDay) / lastSameDay) : null,
  }
}

/** One plain sentence about the change, or null when there is nothing honest to say (no spend last month). Under 5% either way reads as "about the same". */
export function trendSentence(t: CategoryTrend, spentNow: number): string | null {
  if (t.changeVsLast === null) return null
  const pct = Math.round(Math.abs(t.changeVsLast) * 100)
  if (pct < 5) return 'About the same as this point last month'
  const d = (n: number) => `$${Math.round(n).toLocaleString('en-NZ')}`
  return `${t.changeVsLast > 0 ? 'Up' : 'Down'} ${pct}% on this point last month (${d(spentNow)} vs ${d(t.lastSameDay)})`
}
