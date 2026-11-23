import type { Transaction } from './types'
import type { BudgetRow } from './categoryBudgets'

/**
 * A short plain-language review of the last 7 days, built only from numbers already in the app (transactions, category budgets,
 * safe-to-spend). Every sentence is arithmetic you can check; nothing is estimated or invented. No transactions -> one gentle nudge.
 */
export interface WeeklyReviewInput {
  transactions: readonly Transaction[]
  todayIso: string
  budgetRows: readonly BudgetRow[]
  dailyAllowance: number | null
  daysToPayday: number | null
}
export interface WeeklyReview { headline: string; lines: string[]; hasData: boolean }

const money = (n: number) => '$' + Math.abs(n).toLocaleString('en-NZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

function addDays(iso: string, d: number): string {
  const [y, m, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day + d)).toISOString().slice(0, 10)
}

function spendBetween(txs: readonly Transaction[], fromIso: string, toIso: string): { total: number; byCat: Map<string, number> } {
  const byCat = new Map<string, number>()
  let total = 0
  for (const t of txs) {
    if (t.amount >= 0 || t.date < fromIso || t.date > toIso) continue
    total += -t.amount
    byCat.set(t.category, (byCat.get(t.category) ?? 0) + -t.amount)
  }
  return { total: Math.round(total * 100) / 100, byCat }
}

export function buildWeeklyReview(i: WeeklyReviewInput): WeeklyReview {
  const thisFrom = addDays(i.todayIso, -6)
  const prevFrom = addDays(i.todayIso, -13)
  const prevTo = addDays(i.todayIso, -7)
  const cur = spendBetween(i.transactions, thisFrom, i.todayIso)
  const prev = spendBetween(i.transactions, prevFrom, prevTo)
  const lines: string[] = []

  if (cur.total === 0 && prev.total === 0) {
    return {
      headline: 'Your week, once you add a statement',
      hasData: false,
      lines: ['Import a bank statement on Transactions and this fills in with your spending, budgets and what is safe to spend.'],
    }
  }

  const diff = Math.round((cur.total - prev.total) * 100) / 100
  let headline = 'You spent ' + money(cur.total) + ' in the last 7 days'
  if (prev.total > 0) {
    headline += diff === 0 ? ', the same as the week before' : diff > 0 ? ', ' + money(diff) + ' more than the week before' : ', ' + money(diff) + ' less than the week before'
  }
  lines.push(headline + '.')

  const top = [...cur.byCat.entries()].filter(([c]) => c !== 'uncategorised').sort((a, b) => b[1] - a[1])[0]
  if (top) lines.push('Most of it went on ' + top[0] + ' (' + money(top[1]) + ').')

  const over = i.budgetRows.filter((r) => r.status === 'over')
  const watch = i.budgetRows.filter((r) => r.status === 'watch')
  if (over.length > 0) {
    const names = over.map((r) => r.category).join(' and ')
    const verb = over.length === 1 ? 'is' : 'are'
    const poss = over.length === 1 ? 'its' : 'their'
    lines.push(names + ' ' + verb + ' over ' + poss + ' monthly target' + (over.length === 1 ? ' by ' + money(-over[0].remaining) : '') + '.')
  } else if (watch.length > 0) {
    lines.push(watch[0].category + ' is running ahead of pace: ' + money(watch[0].spent) + ' of ' + money(watch[0].target) + ' used.')
  } else if (i.budgetRows.some((r) => r.target > 0)) {
    lines.push('Every budgeted category is on track this month.')
  }

  if (i.dailyAllowance !== null && i.daysToPayday !== null) {
    lines.push(
      i.dailyAllowance > 0
        ? 'You can spend about ' + money(i.dailyAllowance) + ' a day until payday (' + i.daysToPayday + (i.daysToPayday === 1 ? ' day' : ' days') + ').'
        : 'There is nothing left to spend freely until payday, so hold off on extras.',
    )
  }
  return { headline, hasData: true, lines }
}
