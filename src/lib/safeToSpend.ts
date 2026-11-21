import type { AppState } from './store'
import type { HouseholdView } from './types'
import { addDaysIso, daysBetweenIso, householdShare, incomeOnDate, nextMonthlyDueDate } from './logic'
import { computeLiveFunds } from './liveFunds'

/** Below this many dollars a day to the next payday, "free to spend" is flagged as tight. */
export const TIGHT_DAILY_DOLLARS = 10

export interface SafeToSpendWarning {
  id: 'overspent' | 'bill-before-payday' | 'tight-daily'
  severity: 'critical' | 'warning'
  message: string
}
export interface SafeToSpend {
  /** Whole days from today up to and including the day before the next payday (1 to 7; 7 when no payday is in sight). */
  daysToPayday: number
  /** Free to spend divided by those days, never below 0. */
  dailyAllowance: number
  warnings: SafeToSpendWarning[]
}

const money = (n: number) => `$${Math.abs(n).toFixed(2)}`

/**
 * Plain-arithmetic warnings built on the same Live Funds number Home and Upcoming already show,
 * so they cannot disagree with it. No forecast or guess: every message is a sum the user can check.
 * - overspent: Live Funds is below zero.
 * - bill-before-payday: bills due before the next payday add up to more than the cash in the live accounts.
 * - tight-daily: Live Funds is positive but under TIGHT_DAILY_DOLLARS a day until payday.
 */
export function computeSafeToSpend(
  state: Pick<AppState, 'accounts' | 'bills' | 'periodicBills' | 'sinkingFunds' | 'savingsGoals' | 'incomeAnchor' | 'spendTracker'>,
  today: string,
  view: HouseholdView,
): SafeToSpend {
  const lf = computeLiveFunds(state, today, 'week', view)
  let daysToPayday = 7
  if (view !== 'mimi') {
    for (let i = 1; i <= 7; i++) {
      if (incomeOnDate(addDaysIso(today, i), state.incomeAnchor) > 0) { daysToPayday = i; break }
    }
  }
  const dailyAllowance = Math.max(0, Math.round((lf.liveFundsAvailable / daysToPayday) * 100) / 100)
  const warnings: SafeToSpendWarning[] = []

  if (lf.liveFundsAvailable < 0) {
    warnings.push({ id: 'overspent', severity: 'critical', message: `You are ${money(lf.liveFundsAvailable)} over what is free to spend this week.` })
  }

  const cash = lf.hsbc + lf.overdraft
  const lastDay = addDaysIso(today, daysToPayday - 1)
  const due = state.bills
    .filter((b) => b.active && b.frequency === 'monthly')
    .map((b) => ({ name: b.name, amount: householdShare(b.amount, b.owner, b.sharedSplitDeepPercent, view), date: nextMonthlyDueDate(b.dueDay, today) }))
    .filter((b) => b.amount > 0 && b.date >= today && b.date <= lastDay)
  const dueTotal = due.reduce((s, b) => s + b.amount, 0)
  if (due.length > 0 && dueTotal > cash) {
    const first = due.sort((a, b) => a.date.localeCompare(b.date))[0]
    warnings.push({
      id: 'bill-before-payday', severity: 'critical',
      message: `Bills due before payday (${money(dueTotal)}, first is ${first.name} in ${daysBetweenIso(today, first.date)} days) are more than the ${money(cash)} in your accounts now.`,
    })
  }

  if (lf.liveFundsAvailable >= 0 && dailyAllowance < TIGHT_DAILY_DOLLARS) {
    warnings.push({ id: 'tight-daily', severity: 'warning', message: `Only ${money(dailyAllowance)} a day is free to spend until payday (${daysToPayday} day${daysToPayday === 1 ? '' : 's'}).` })
  }
  return { daysToPayday, dailyAllowance, warnings }
}
