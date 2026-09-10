import React, { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  RecurringBill, Mode, Country, Transaction, Debt, CreditCardAccount, DeviceRepayment, PeriodicBill,
  Account, NetWorthSnapshot, SavingsGoal, OneOffEntry, SinkingFund, SpendTracker, StreakState, HouseholdView,
  PaymentRecord,
} from './types'
import { SEED_BILLS, SEED_CREDIT_CARDS, SEED_DEVICE_REPAYMENTS, SEED_PERIODIC_BILLS, SEED_ACCOUNTS } from './constants'
import {
  calcNetWorth, upsertNetWorthSnapshot, applyBillAmountChange, computeCurrentHealthScore,
  applyPaymentToCard, applyPaymentToPlan, applyPaymentToPeriodicBill, applyPaymentToDevice,
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
  /** Real payment history — amount + date per payment, reduces the real balance it targets (#8, Round 20). See PaymentRecord in types.ts. */
  paymentRecords: PaymentRecord[]
  /** #38 — real sound design toggle, OFF by default per the explicit ask. */
  soundEnabled: boolean
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
  paymentRecords: [],
  soundEnabled: false,
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
  /** Round 20 finding: CSV import correctly never invents a category (real bank exports don't
      have one) — but with no way to EDIT it afterward, every imported row stayed "uncategorised"
      forever, starving the new category-colour/trend features of real input. Closes that gap. */
  updateTransaction: (id: string, patch: Partial<Transaction>) => void
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
  setSoundEnabled: (enabled: boolean) => void
  /** #8 expanded — records a real amount+date payment AND reduces the real balance/remaining it targets. Returns the new record's id. */
  recordPayment: (input: Omit<PaymentRecord, 'id' | 'recordedAt'>) => string
  /** Reverses a payment's balance effect and removes it — the real Undo for #8's toast action. */
  deletePaymentRecord: (id: string) => void
  /** #49 — restores a full previous state snapshot, used by the toast "Undo" action on destructive edits. */
  restoreState: (snapshot: AppState) => void
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

    const { score } = computeCurrentHealthScore({
      bills: state.bills,
      creditCards: state.creditCards,
      debts: state.debts,
      accounts: state.accounts,
      grossAnnualIncome: state.grossAnnualIncome,
      country: state.country,
    })

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
    updateTransaction: (id, patch) => setState((s) => ({ ...s, transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
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
    recordPayment: (input) => {
      const id = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const record: PaymentRecord = { ...input, id, recordedAt: new Date().toISOString() }
      setState((s) => {
        let creditCards = s.creditCards
        let periodicBills = s.periodicBills
        let deviceRepayments = s.deviceRepayments
        if (record.targetType === 'creditCard') {
          creditCards = s.creditCards.map((c) => (c.id === record.targetId ? applyPaymentToCard(c, record.amount) : c))
        } else if (record.targetType === 'installmentPlan') {
          creditCards = s.creditCards.map((c) => ({ ...c, plans: c.plans.map((p) => (p.id === record.targetId ? applyPaymentToPlan(p, record.amount) : p)) }))
        } else if (record.targetType === 'periodicBill') {
          periodicBills = s.periodicBills.map((b) => (b.id === record.targetId ? applyPaymentToPeriodicBill(b, record.amount) : b))
        } else if (record.targetType === 'deviceRepayment') {
          deviceRepayments = s.deviceRepayments.map((d) =>
            d.id === record.targetId ? { ...applyPaymentToDevice(d, record.amount), paymentsRemaining: Math.max(0, d.paymentsRemaining - 1) } : d
          )
        }
        // recurringBill payments don't reduce any balance (a flat recurring amount, not a running
        // balance) — the payment record itself, with its dueDateIso, is the only effect needed.
        return { ...s, creditCards, periodicBills, deviceRepayments, paymentRecords: [...s.paymentRecords, record] }
      })
      return id
    },
    deletePaymentRecord: (id) =>
      setState((s) => {
        const record = s.paymentRecords.find((r) => r.id === id)
        if (!record) return s
        let creditCards = s.creditCards
        let periodicBills = s.periodicBills
        let deviceRepayments = s.deviceRepayments
        const reverseAmount = -record.amount
        if (record.targetType === 'creditCard') {
          creditCards = s.creditCards.map((c) => (c.id === record.targetId ? applyPaymentToCard(c, reverseAmount) : c))
        } else if (record.targetType === 'installmentPlan') {
          creditCards = s.creditCards.map((c) => ({ ...c, plans: c.plans.map((p) => (p.id === record.targetId ? applyPaymentToPlan(p, reverseAmount) : p)) }))
        } else if (record.targetType === 'periodicBill') {
          periodicBills = s.periodicBills.map((b) => (b.id === record.targetId ? applyPaymentToPeriodicBill(b, reverseAmount) : b))
        } else if (record.targetType === 'deviceRepayment') {
          deviceRepayments = s.deviceRepayments.map((d) =>
            d.id === record.targetId ? { ...applyPaymentToDevice(d, reverseAmount), paymentsRemaining: d.paymentsRemaining + 1 } : d
          )
        }
        return { ...s, creditCards, periodicBills, deviceRepayments, paymentRecords: s.paymentRecords.filter((r) => r.id !== id) }
      }),
    restoreState: (snapshot) => setState(snapshot),
    setSoundEnabled: (enabled) => setState((s) => ({ ...s, soundEnabled: enabled })),
  }), [state])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
