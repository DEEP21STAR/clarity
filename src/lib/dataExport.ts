import type { AppState } from './store'

/**
 * Full data export — feature 14. Genuinely complete, self-describing JSON
 * (clear key names, not abbreviated) for a SEPARATE local agent (a free
 * local-LLM query tool + bar-widget on Deep's desktop) to consume with no
 * shared context with this app. Shape documented in EXPORT_SCHEMA.md at the
 * project root — keep the two in sync if this function's shape ever changes.
 */
export interface ClarityExport {
  schemaVersion: number
  exportedAt: string // ISO datetime
  mode: AppState['mode']
  country: AppState['country']
  grossAnnualIncome: number
  accounts: AppState['accounts']
  recurringBills: AppState['bills']
  periodicBills: AppState['periodicBills']
  sinkingFunds: AppState['sinkingFunds']
  savingsGoals: AppState['savingsGoals']
  creditCards: AppState['creditCards']
  deviceRepayments: AppState['deviceRepayments']
  debts: AppState['debts']
  transactions: AppState['transactions']
  oneOffEntries: AppState['oneOffEntries']
  netWorthHistory: AppState['netWorthHistory']
  householdView: AppState['householdView']
  streak: AppState['streak']
}

export function buildFullExportJson(state: AppState): ClarityExport {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    mode: state.mode,
    country: state.country,
    grossAnnualIncome: state.grossAnnualIncome,
    accounts: state.accounts,
    recurringBills: state.bills,
    periodicBills: state.periodicBills,
    sinkingFunds: state.sinkingFunds,
    savingsGoals: state.savingsGoals,
    creditCards: state.creditCards,
    deviceRepayments: state.deviceRepayments,
    debts: state.debts,
    transactions: state.transactions,
    oneOffEntries: state.oneOffEntries,
    netWorthHistory: state.netWorthHistory,
    householdView: state.householdView,
    streak: state.streak,
  }
}

// Real file saving lives in `src/lib/downloads.ts` (the `downloads` runtime
// capability) — a plain `<a download>` link does nothing inside the artifact
// viewer sandbox for any viewer, owner included, so that approach was removed.
