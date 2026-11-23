import type { Transaction } from './types'

/**
 * "Last month in review": a recap of the most recent COMPLETE calendar month, built only from transactions already in the app.
 * Every figure is arithmetic you can check; nothing is estimated. Returns null when that month has no transactions.
 */
export interface MonthRecap {
  monthLabel: string // e.g. "October 2026"
  spent: number
  income: number
  net: number // income - spent
  vsPrevious: number | null // spent - spent in the month before; null when the month before had no spending
  topCategories: { category: string; amount: number; share: number }[] // up to 3, share 0..1 of total spend
  busiestDay: { date: string; amount: number } | null
  biggestExpense: { description: string; amount: number; date: string } | null
  noSpendDays: number
  daysInMonth: number
}

const r2 = (n: number) => Math.round(n * 100) / 100
const pad = (n: number) => String(n).padStart(2, '0')
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function monthBefore(year: number, month0: number) {
  return month0 === 0 ? { year: year - 1, month0: 11 } : { year, month0: month0 - 1 }
}

function inMonth(t: Transaction, year: number, month0: number) {
  return t.date.startsWith(`${year}-${pad(month0 + 1)}-`)
}

export function buildMonthRecap(transactions: readonly Transaction[], todayIso: string): MonthRecap | null {
  const [ty, tm] = todayIso.split('-').map(Number)
  const { year, month0 } = monthBefore(ty, tm - 1)
  const prev = monthBefore(year, month0)
  const inThis = transactions.filter((t) => inMonth(t, year, month0))
  if (inThis.length === 0) return null

  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
  const byCat = new Map<string, number>()
  const byDay = new Map<string, number>()
  let spent = 0
  let income = 0
  let biggest: Transaction | null = null
  for (const t of inThis) {
    if (t.amount >= 0) { income += t.amount; continue }
    const a = -t.amount
    spent += a
    byCat.set(t.category, (byCat.get(t.category) ?? 0) + a)
    byDay.set(t.date, (byDay.get(t.date) ?? 0) + a)
    if (!biggest || a > -biggest.amount) biggest = t
  }
  const prevSpent = transactions.filter((t) => t.amount < 0 && inMonth(t, prev.year, prev.month0)).reduce((s, t) => s + -t.amount, 0)
  const topCategories = [...byCat.entries()]
    .filter(([c]) => c !== 'uncategorised')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amount]) => ({ category, amount: r2(amount), share: spent > 0 ? amount / spent : 0 }))
  const busiest = [...byDay.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]

  return {
    monthLabel: `${MONTHS[month0]} ${year}`,
    spent: r2(spent),
    income: r2(income),
    net: r2(income - spent),
    vsPrevious: prevSpent > 0 ? r2(spent - prevSpent) : null,
    topCategories,
    busiestDay: busiest ? { date: busiest[0], amount: r2(busiest[1]) } : null,
    biggestExpense: biggest ? { description: biggest.description, amount: r2(-biggest.amount), date: biggest.date } : null,
    noSpendDays: daysInMonth - byDay.size,
    daysInMonth,
  }
}
