import React, { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  RecurringBill, Mode, Country, Transaction, Debt, CreditCardAccount, DeviceRepayment, PeriodicBill,
  Account, NetWorthSnapshot, SavingsGoal, OneOffEntry, SinkingFund, SpendTracker, StreakState, HouseholdView,
} from './types'
import { SEED_BILLS, SEED_CREDIT_CARDS, SEED_DEVICE_REPAYMENTS, SEED_PERIODIC_BILLS, SEED_ACCOUNTS } from './constants'
import {
  calcNetWorth, upsertNetWorthSnapshot, applyBillAmountChange, calcFinancialHealthScore,
  emergencyFundMonths, monthlyEquivalent, nzNetIncome, auNetIncome,
} from './logic'
import { todayIso } from './utils'

// Bumped v4 -> v5: replaced the flat HSBC/Overdraft/Savings `balances` list
// with a proper Accounts concept (+ Car/Home/Other manual assets) and added
// net worth history, savings goals, one-off entries, sinking funds, household
// view, spend tracking, streaks, and the export timestamp. A stale v4 blob
// has no `accounts` array at all, so it's not reused.
const STORAGE_KEY = 'clarity-dashboard-state-v5'

export interface AppState {
  mode: Mode
  country: Country
  bills: RecurringBill[]
  accounts: Account[]
  transactions: Transaction[]
  debts: Debt[]
  savingsGoal: number
  grossAnnualIncome: number
  creditCards: CreditCardAccount[]
  deviceRepayments: DeviceRepayment[]
  periodicBills: PeriodicBill[]
  netWorthHistory: NetWorthSnapshot[]
  savingsGoals: SavingsGoal[]
  oneOffEntries: OneOffEntry[]
  sinkingFunds: SinkingFund[]
  householdView: HouseholdView
  spendTracker: SpendTracker
  streak: StreakState
  lastExportedAt: string | null
  /** One health-score reading per real calendar day — feeds the "score up/down X points" ticker line. */
  healthScoreHistory: { date: string; score: number }[]
  /** Order of the draggable Dashboard card blocks — persisted so a reorder sticks across sessions. */
  dashboardCardOrder: string[]
}

const DEFAULT_STATE: AppState = {
  mode: 'personal',
  country: 'NZ',
  bills: SEED_BILLS,
  accounts: SEED_ACCOUNTS,
  transactions: [],
  debts: [],
  savingsGoal: 5000,
  grossAnnualIncome: 65000,
  creditCards: SEED_CREDIT_CARDS,
  deviceRepayments: SEED_DEVICE_REPAYMENTS,
  periodicBills: SEED_PERIODIC_BILLS,
  netWorthHistory: [],
  savingsGoals: [],
  oneOffEntries: [],
  sinkingFunds: [],
  householdView: 'combined',
  spendTracker: { food: 0, fuel: 0, personal: 0, periodStart: todayIso() },
  streak: { current: 0, best: 0, lastCheckedDate: '', milestonesHit: [] },
  lastExportedAt: null,
  healthScoreHistory: [],
  dashboardCardOrder: ['stats', 'health', 'tax', 'insights'],
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw)
    // Merge with defaults so new fields introduced later don't crash old saved state.
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return DEFAULT_STATE
  }
}

interface StoreContextValue {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  updateBill: (id: string, patch: Partial<RecurringBill>) => void
  addBill: (bill: RecurringBill) => void
  removeBill: (id: string) => void
  updateAccount: (id: string, patch: Partial<Account>) => void
  setMode: (mode: Mode) => void
  setCountry: (country: Country) => void
  addTransactions: (txs: Transaction[]) => void
  setGrossAnnualIncome: (v: number) => void
  addDebt: (debt: Debt) => void
  removeDebt: (id: string) => void
  updateDebt: (id: string, patch: Partial<Debt>) => void
  addPeriodicBill: (bill: PeriodicBill) => void
  removePeriodicBill: (id: string) => void
  updatePeriodicBill: (id: string, patch: Partial<PeriodicBill>) => void
  addSavingsGoal: (goal: SavingsGoal) => void
  updateSavingsGoal: (id: string, patch: Partial<SavingsGoal>) => void
  removeSavingsGoal: (id: string) => void
  logGoalContribution: (id: string) => void
  addOneOffEntry: (entry: OneOffEntry) => void
  removeOneOffEntry: (id: string) => void
  addSinkingFund: (fund: SinkingFund) => void
  updateSinkingFund: (id: string, patch: Partial<SinkingFund>) => void
  removeSinkingFund: (id: string) => void
  setHouseholdView: (view: HouseholdView) => void
  updateSpendTracker: (patch: Partial<SpendTracker>) => void
  resetSpendTracker: (periodStart: string) => void
  setStreak: (streak: StreakState) => void
  setLastExportedAt: (iso: string) => void
  markDebtPaidOff: (id: string) => void
  setDashboardCardOrder: (order: string[]) => void
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState)
  const lastNetWorthInputs = useRef<string>('')

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Storage unavailable (private mode etc) — fail silently, app still works in-memory.
    }
  }, [state])

  // Net worth snapshot — at most one entry per calendar day, recomputed whenever
  // the underlying accounts/cards/debts actually change (not on every render).
  useEffect(() => {
    const fingerprint = JSON.stringify([state.accounts, state.creditCards.map((c) => c.balance), state.debts])
    if (fingerprint === lastNetWorthInputs.current) return
    lastNetWorthInputs.current = fingerprint
    const breakdown = calcNetWorth(state.accounts, state.creditCards, state.debts)
    const today = todayIso()
    setState((s) => ({
      ...s,
      netWorthHistory: upsertNetWorthSnapshot(s.netWorthHistory, { date: today, ...breakdown }),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.accounts, state.creditCards, state.debts])

  // Health-score snapshot — same one-per-day pattern as net worth, so the
  // insights ticker can say something real like "score up 4 points" instead
  // of inventing a trend.
  const lastHealthInputs = useRef<string>('')
  useEffect(() => {
    const fingerprint = JSON.stringify([state.accounts, state.creditCards, state.debts, state.bills, state.grossAnnualIncome, state.country])
    if (fingerprint === lastHealthInputs.current) return
    lastHealthInputs.current = fingerprint

    const net = state.country === 'NZ' ? nzNetIncome(state.grossAnnualIncome) : auNetIncome(state.grossAnnualIncome)
    const monthlyNet = net.net / 12
    const monthlyBills = state.bills.filter((b) => b.active).reduce((s, b) => s + monthlyEquivalent(b.amount, b.frequency), 0)
    const savingsBalance = state.accounts.find((a) => a.id === 'savings')?.value ?? 0
    const savingsRate = monthlyNet > 0 ? (monthlyNet - monthlyBills) / monthlyNet : 0
    const totalDebtBalance = state.debts.reduce((s, d) => s + d.balance, 0) + state.creditCards.reduce((s, c) => s + c.balance, 0)
    const debtToIncome = net.net > 0 ? totalDebtBalance / net.net : 1
    const billCoverageRatio = monthlyBills > 0 ? monthlyNet / monthlyBills : 2
    const efMonths = emergencyFundMonths(savingsBalance, monthlyBills)
    const { score } = calcFinancialHealthScore({ savingsRate, debtToIncome, billCoverageRatio, emergencyFundMonths: efMonths })

    const today = todayIso()
    setState((s) => {
      const existingIdx = s.healthScoreHistory.findIndex((h) => h.date === today)
      const next = [...s.healthScoreHistory]
      if (existingIdx === -1) next.push({ date: today, score })
      else next[existingIdx] = { date: today, score }
      return { ...s, healthScoreHistory: next.sort((a, b) => a.date.localeCompare(b.date)) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.accounts, state.creditCards, state.debts, state.bills, state.grossAnnualIncome, state.country])

  const value = useMemo<StoreContextValue>(() => ({
    state,
    setState,
    updateBill: (id, patch) =>
      setState((s) => ({
        ...s,
        bills: s.bills.map((b) => {
          if (b.id !== id) return b
          const amountPatch = patch.amount !== undefined ? applyBillAmountChange(b, patch.amount) : {}
          return { ...b, ...patch, ...amountPatch }
        }),
      })),
    addBill: (bill) => setState((s) => ({ ...s, bills: [...s.bills, bill] })),
    removeBill: (id) => setState((s) => ({ ...s, bills: s.bills.filter((b) => b.id !== id) })),
    updateAccount: (id, patch) =>
      setState((s) => ({ ...s, accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
    setMode: (mode) => setState((s) => ({ ...s, mode })),
    setCountry: (country) => setState((s) => ({ ...s, country })),
    addTransactions: (txs) => setState((s) => ({ ...s, transactions: [...txs, ...s.transactions] })),
    setGrossAnnualIncome: (v) => setState((s) => ({ ...s, grossAnnualIncome: v })),
    addDebt: (debt) => setState((s) => ({ ...s, debts: [...s.debts, debt] })),
    removeDebt: (id) => setState((s) => ({ ...s, debts: s.debts.filter((d) => d.id !== id) })),
    updateDebt: (id, patch) => setState((s) => ({ ...s, debts: s.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
    markDebtPaidOff: (id) => setState((s) => ({ ...s, debts: s.debts.map((d) => (d.id === id ? { ...d, balance: 0 } : d)) })),
    addPeriodicBill: (bill) => setState((s) => ({ ...s, periodicBills: [...s.periodicBills, bill] })),
    removePeriodicBill: (id) => setState((s) => ({ ...s, periodicBills: s.periodicBills.filter((b) => b.id !== id) })),
    updatePeriodicBill: (id, patch) =>
      setState((s) => ({ ...s, periodicBills: s.periodicBills.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
    addSavingsGoal: (goal) => setState((s) => ({ ...s, savingsGoals: [...s.savingsGoals, goal] })),
    updateSavingsGoal: (id, patch) =>
      setState((s) => ({ ...s, savingsGoals: s.savingsGoals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
    removeSavingsGoal: (id) => setState((s) => ({ ...s, savingsGoals: s.savingsGoals.filter((g) => g.id !== id) })),
    logGoalContribution: (id) =>
      setState((s) => ({
        ...s,
        savingsGoals: s.savingsGoals.map((g) =>
          g.id === id ? { ...g, contributedAmount: g.contributedAmount + g.fundedThisPeriod } : g
        ),
      })),
    addOneOffEntry: (entry) => setState((s) => ({ ...s, oneOffEntries: [entry, ...s.oneOffEntries] })),
    removeOneOffEntry: (id) => setState((s) => ({ ...s, oneOffEntries: s.oneOffEntries.filter((e) => e.id !== id) })),
    addSinkingFund: (fund) => setState((s) => ({ ...s, sinkingFunds: [...s.sinkingFunds, fund] })),
    updateSinkingFund: (id, patch) =>
      setState((s) => ({ ...s, sinkingFunds: s.sinkingFunds.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
    removeSinkingFund: (id) => setState((s) => ({ ...s, sinkingFunds: s.sinkingFunds.filter((f) => f.id !== id) })),
    setHouseholdView: (view) => setState((s) => ({ ...s, householdView: view })),
    updateSpendTracker: (patch) => setState((s) => ({ ...s, spendTracker: { ...s.spendTracker, ...patch } })),
    resetSpendTracker: (periodStart) => setState((s) => ({ ...s, spendTracker: { food: 0, fuel: 0, personal: 0, periodStart } })),
    setStreak: (streak) => setState((s) => ({ ...s, streak })),
    setLastExportedAt: (iso) => setState((s) => ({ ...s, lastExportedAt: iso })),
    setDashboardCardOrder: (order) => setState((s) => ({ ...s, dashboardCardOrder: order })),
  }), [state])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
