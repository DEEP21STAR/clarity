import type { AppState } from './store'
import type { HouseholdView } from './types'
import {
  totalIncomeInWindow, totalBillsInWindow, totalPeriodicSmoothedInWindow, totalSinkingFundsSmoothedInWindow, windowLengthDays, addDaysIso,
} from './logic'

/**
 * Live Funds Available maths, extracted verbatim from UpcomingPayments.tsx so the mobile Home
 * screen and the Upcoming tab can never disagree. Same inputs, same rounding, same formula:
 * HSBC + overdraft + income in window - (flat bills + smoothed periodic + sinking funds +
 * goal funding) - tracked spend.
 */
export function computeLiveFunds(
  state: Pick<AppState, 'accounts' | 'bills' | 'periodicBills' | 'sinkingFunds' | 'savingsGoals' | 'incomeAnchor' | 'spendTracker'>,
  today: string,
  window_: 'week' | 'fortnight' | 'month',
  view: HouseholdView
) {
  const windowEnd = addDaysIso(today, windowLengthDays(window_) - 1)
  const incomeInWindow = view === 'mimi' ? 0 : totalIncomeInWindow(today, windowEnd, state.incomeAnchor)
  const flatBillsInWindow = totalBillsInWindow(state.bills, today, windowEnd, view)
  const periodicSmoothedInWindow = totalPeriodicSmoothedInWindow(state.periodicBills, today, windowEnd, today, view)
  const sinkingFundsInWindow = totalSinkingFundsSmoothedInWindow(state.sinkingFunds, today, windowEnd, today)
  const goalsFundedInWindow = state.savingsGoals.reduce((s, g) => s + g.fundedThisPeriod, 0)
  const billsInWindow = Math.round((flatBillsInWindow + periodicSmoothedInWindow + sinkingFundsInWindow + goalsFundedInWindow) * 100) / 100
  const hsbc = state.accounts.find((a) => a.id === 'hsbc')?.value ?? 0
  const overdraft = state.accounts.find((a) => a.id === 'overdraft')?.value ?? 0
  const liveFundsBeforeSpend = Math.round((hsbc + overdraft + incomeInWindow - billsInWindow) * 100) / 100
  const spentTracked = state.spendTracker.food + state.spendTracker.fuel + state.spendTracker.personal
  const liveFundsAvailable = Math.round((liveFundsBeforeSpend - spentTracked) * 100) / 100
  return { windowEnd, incomeInWindow, billsInWindow, hsbc, overdraft, liveFundsBeforeSpend, spentTracked, liveFundsAvailable }
}

/**
 * Quick entry from the mobile "+ Add" sheet, built only on existing mechanisms:
 * - expense dated today or earlier: spendTracker.personal += amount (the exact field Upcoming's
 *   quick-log uses to lower Live Funds) PLUS a categorised one-off record for the forecast.
 * - income dated today or earlier: HSBC balance += amount (the existing editable balance). No
 *   one-off record, because the forecast starts from that balance and would count it twice.
 * - future-dated: one-off entry only (forecast), Live Funds is unchanged until the day arrives.
 */
export function applyQuickEntry(
  s: AppState,
  e: { kind: 'expense' | 'income'; amount: number; description: string; date: string },
  today: string,
  id: string
): AppState {
  const amt = Math.round(Math.abs(e.amount) * 100) / 100
  if (!(amt > 0)) return s
  const isFuture = e.date > today
  if (e.kind === 'expense') {
    const next: AppState = {
      ...s,
      oneOffEntries: [{ id, date: e.date, description: e.description || 'Quick expense', amount: -amt, category: 'personal' }, ...s.oneOffEntries],
    }
    if (!isFuture) next.spendTracker = { ...s.spendTracker, personal: Math.round((s.spendTracker.personal + amt) * 100) / 100 }
    return next
  }
  if (isFuture) {
    return { ...s, oneOffEntries: [{ id, date: e.date, description: e.description || 'Quick income', amount: amt }, ...s.oneOffEntries] }
  }
  return { ...s, accounts: s.accounts.map((a) => (a.id === 'hsbc' ? { ...a, value: Math.round((a.value + amt) * 100) / 100 } : a)) }
}
