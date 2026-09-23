import React, { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  RecurringBill, Mode, Country, Transaction, Debt, CreditCardAccount, DeviceRepayment, PeriodicBill,
  Account, NetWorthSnapshot, SavingsGoal, OneOffEntry, SinkingFund, SpendTracker, StreakState, HouseholdView,
  PaymentRecord, IncomeAnchor,
} from './types'
import { SEED_BILLS, SEED_CREDIT_CARDS, SEED_DEVICE_REPAYMENTS, SEED_PERIODIC_BILLS, SEED_ACCOUNTS, INCOME_ANCHOR } from './constants'
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
// 2026-09-23 round 5 — exported so App.tsx can check, on first load, whether this browser has
// ever had real app data at all (localStorage.getItem(STORAGE_KEY) === null means genuinely
// first-ever visit) -- the real-onboarding gate. Deep's own account already has this key
// populated from every prior session, so this check alone never re-triggers onboarding for him.
export const STORAGE_KEY = 'clarity-dashboard-state-v5'

export type TextScale = 'small' | 'medium' | 'large'

/** 2026-09-23 round 10 — the wizard's own Identity step already collects this (Male -> light
 * blue neon, Female -> pink neon, Prefer not to say -> neutral cyan/purple), but it was only
 * ever used on the wizard's OWN completion screen, never persisted into the real seed state —
 * so the real dashboard header had no way to give a name its own color identity. Wiring it
 * through properly now (see App.tsx's header). */
export type NameColor = 'blue' | 'pink' | 'neutral'

export interface AppState {
  mode: Mode
  country: Country
  bills: RecurringBill[]
  accounts: Account[]
  transactions: Transaction[]
  debts: Debt[]
  savingsGoal: number
  grossAnnualIncome: number
  /** 2026-09-23 — real per-instance pay pattern (was a single hardcoded INCOME_ANCHOR constant
   * before this). Drives Live Funds Available / Dashboard headline / health score exactly like
   * the old constant did — this is that same real date-math, just no longer locked to one
   * household. Defaults to Deep's own real pattern, so his existing persisted state (which has
   * no incomeAnchor field yet) merges in identically to before — zero change to his real
   * numbers from adding this field. */
  incomeAnchor: IncomeAnchor
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
  /** 2026-09-23 round 6 — real per-instance names, set once during onboarding (see
   * SetupWizard.tsx's buildDemoSeed). Defaults preserve Deep's own existing account's exact
   * current display (his real saved state has no such key, so loadState's merge falls back to
   * these defaults). secondaryName === '' means a genuinely single-person household — the
   * header's Deep/Mimi/Combined view toggle only makes sense once a second person exists. */
  primaryName: string
  secondaryName: string
  /** 2026-09-23 round 10 — real per-instance name color, set once during onboarding. Default
   * 'neutral' matches the wizard's own default and every existing account's current display. */
  primaryColor: NameColor
  secondaryColor: NameColor
  /** 2026-09-23 round 7 — real app-wide text-size preference, default 'small' preserves every
   * existing account's exact current appearance. */
  textScale: TextScale
  /** Real browser Notification permission has been granted AND Deep opted in via Tools —
   * gates whether App.tsx's bill-due check actually fires a notification. Defaults false:
   * never surprise a user with a permission prompt or a notification they didn't ask for. */
  billAlertsEnabled: boolean
}

export const DEFAULT_STATE: AppState = {
  mode: 'personal',
  country: 'NZ',
  bills: SEED_BILLS,
  accounts: SEED_ACCOUNTS,
  transactions: [],
  debts: [],
  savingsGoal: 5000,
  grossAnnualIncome: 65000,
  incomeAnchor: INCOME_ANCHOR,
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
  primaryName: 'Deep',
  secondaryName: 'Mimi',
  primaryColor: 'neutral',
  secondaryColor: 'neutral',
  textScale: 'small',
  billAlertsEnabled: false,
}

/**
 * Real gap this closes: `loadState`'s top-level `{...DEFAULT_STATE, ...parsed}` merge replaces
 * the ENTIRE `bills` array wholesale with whatever's persisted — it doesn't merge per-bill
 * fields. Deep's actual browser has months of real bill edits already in localStorage, from
 * before `paymentMethod` existed, so every one of his real Spotify/Google One/Car Insurance/
 * Contents Home Insurance rows would silently show as 'manual' forever (the safe default, but
 * wrong for these 4 specific real bills he confirmed are direct debit) — confirmed live during
 * testing, not hypothetical. Fills in `paymentMethod` from SEED_BILLS by matching bill `id`,
 * but ONLY when the persisted bill doesn't already have one set — never overwrites a value
 * Deep already confirmed/toggled himself. One-time, additive, safe to run on every load.
 */
function backfillPaymentMethod(bills: RecurringBill[]): RecurringBill[] {
  return bills.map((bill) => {
    if (bill.paymentMethod) return bill
    const seed = SEED_BILLS.find((s) => s.id === bill.id)
    return seed?.paymentMethod ? { ...bill, paymentMethod: seed.paymentMethod } : bill
  })
}

function loadState(key: string, fallback: AppState): AppState {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    // Merge with defaults so new fields introduced later don't crash old saved state.
    const merged: AppState = { ...fallback, ...parsed }
    return { ...merged, bills: backfillPaymentMethod(merged.bills) }
  } catch {
    return fallback
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
  /** Round 21 — a genuine gap: CSV import + inline category edit existed, but a mistaken/duplicate import row had no way to be removed. */
  removeTransaction: (id: string) => void
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
  /** Round 21 — device repayments had no add/remove UI at all; a fully-paid-off device stayed on screen forever with no way to clear it. */
  addDeviceRepayment: (device: DeviceRepayment) => void
  updateDeviceRepayment: (id: string, patch: Partial<DeviceRepayment>) => void
  removeDeviceRepayment: (id: string) => void
  setDashboardCardOrder: (order: string[]) => void
  setSoundEnabled: (enabled: boolean) => void
  /** 2026-09-23 round 7 — "ability to increase font sizes with 3 options" (Deep). Tailwind's
   * text-* utilities are all rem-based, so scaling the root <html> font-size (see the CSS rules
   * this drives) scales every existing size across the whole app for free, no per-component
   * changes needed. */
  setTextScale: (scale: TextScale) => void
  setBillAlertsEnabled: (enabled: boolean) => void
  /** #8 expanded — records a real amount+date payment AND reduces the real balance/remaining it targets. Returns the new record's id. */
  recordPayment: (input: Omit<PaymentRecord, 'id' | 'recordedAt'>) => string
  /** Reverses a payment's balance effect and removes it — the real Undo for #8's toast action. */
  deletePaymentRecord: (id: string) => void
  /** #49 — restores a full previous state snapshot, used by the toast "Undo" action on destructive edits. */
  restoreState: (snapshot: AppState) => void
}

const StoreContext = createContext<StoreContextValue | null>(null)

/**
 * 2026-09-23 — `storageKey`/`seedState` let a second, fully isolated instance of the real app
 * mount (the wizard preview's "launch a live dashboard from what you just entered") without
 * ever touching Deep's own real 'clarity-dashboard-state-v5' data. Both are optional and
 * default to the original single-instance behavior, so every existing call site
 * (<StoreProvider><AppContent/></StoreProvider> in App()) is completely unaffected — this is
 * additive, not a behavior change to the real app. `seedState`, when given, is ONLY the
 * first-load fallback (a fresh key with nothing saved yet) — once something's actually
 * persisted under that key, the saved state wins on every subsequent load, same as normal.
 */
export function StoreProvider({ children, storageKey = STORAGE_KEY, seedState = DEFAULT_STATE }: { children: ReactNode; storageKey?: string; seedState?: AppState }) {
  const [state, setState] = useState<AppState>(() => loadState(storageKey, seedState))
  const lastNetWorthInputs = useRef<string>('')

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      // Storage unavailable (private mode etc) — fail silently, app still works in-memory.
    }
  }, [state, storageKey])

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
    removeTransaction: (id) => setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) })),
    setGrossAnnualIncome: (v) => setState((s) => ({ ...s, grossAnnualIncome: v })),
    addDebt: (debt) => setState((s) => ({ ...s, debts: [...s.debts, debt] })),
    removeDebt: (id) => setState((s) => ({ ...s, debts: s.debts.filter((d) => d.id !== id) })),
    updateDebt: (id, patch) => setState((s) => ({ ...s, debts: s.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
    markDebtPaidOff: (id) => setState((s) => ({ ...s, debts: s.debts.map((d) => (d.id === id ? { ...d, balance: 0 } : d)) })),
    addDeviceRepayment: (device) => setState((s) => ({ ...s, deviceRepayments: [...s.deviceRepayments, device] })),
    updateDeviceRepayment: (id, patch) =>
      setState((s) => ({ ...s, deviceRepayments: s.deviceRepayments.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
    removeDeviceRepayment: (id) => setState((s) => ({ ...s, deviceRepayments: s.deviceRepayments.filter((d) => d.id !== id) })),
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
    setTextScale: (scale) => setState((s) => ({ ...s, textScale: scale })),
    setBillAlertsEnabled: (enabled) => setState((s) => ({ ...s, billAlertsEnabled: enabled })),
  }), [state])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
