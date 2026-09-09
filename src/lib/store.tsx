import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { RecurringBill, AccountBalance, Mode, Country, Transaction, Debt, CreditCardAccount, DeviceRepayment, PeriodicBill } from './types'
import { SEED_BILLS, SEED_CREDIT_CARDS, SEED_DEVICE_REPAYMENTS, SEED_PERIODIC_BILLS } from './constants'

// Bumped v3 -> v4: bill set changed (Gas/Electricity moved to periodicBills,
// GEM VISA amounts/due-days updated to real figures) and three new data
// shapes were added. A stale v3 blob would merge in old bill ids and miss
// the new sections entirely, so it's not reused.
const STORAGE_KEY = 'clarity-dashboard-state-v4'

export interface AppState {
  mode: Mode
  country: Country
  bills: RecurringBill[]
  balances: AccountBalance[]
  transactions: Transaction[]
  debts: Debt[]
  savingsGoal: number
  grossAnnualIncome: number
  creditCards: CreditCardAccount[]
  deviceRepayments: DeviceRepayment[]
  periodicBills: PeriodicBill[]
}

const DEFAULT_STATE: AppState = {
  mode: 'personal',
  country: 'NZ',
  bills: SEED_BILLS,
  balances: [
    { id: 'hsbc', label: 'HSBC', value: 0 },
    { id: 'overdraft', label: 'Overdraft', value: 0 },
    { id: 'savings', label: 'Savings', value: 0 },
  ],
  transactions: [],
  debts: [],
  savingsGoal: 5000,
  grossAnnualIncome: 65000,
  creditCards: SEED_CREDIT_CARDS,
  deviceRepayments: SEED_DEVICE_REPAYMENTS,
  periodicBills: SEED_PERIODIC_BILLS,
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
  updateBalance: (id: AccountBalance['id'], value: number) => void
  setMode: (mode: Mode) => void
  setCountry: (country: Country) => void
  addTransactions: (txs: Transaction[]) => void
  setGrossAnnualIncome: (v: number) => void
  addDebt: (debt: Debt) => void
  removeDebt: (id: string) => void
  updateDebt: (id: string, patch: Partial<Debt>) => void
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Storage unavailable (private mode etc) — fail silently, app still works in-memory.
    }
  }, [state])

  const value = useMemo<StoreContextValue>(() => ({
    state,
    setState,
    updateBill: (id, patch) =>
      setState((s) => ({ ...s, bills: s.bills.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
    addBill: (bill) => setState((s) => ({ ...s, bills: [...s.bills, bill] })),
    removeBill: (id) => setState((s) => ({ ...s, bills: s.bills.filter((b) => b.id !== id) })),
    updateBalance: (id, val) =>
      setState((s) => ({ ...s, balances: s.balances.map((b) => (b.id === id ? { ...b, value: val } : b)) })),
    setMode: (mode) => setState((s) => ({ ...s, mode })),
    setCountry: (country) => setState((s) => ({ ...s, country })),
    addTransactions: (txs) => setState((s) => ({ ...s, transactions: [...txs, ...s.transactions] })),
    setGrossAnnualIncome: (v) => setState((s) => ({ ...s, grossAnnualIncome: v })),
    addDebt: (debt) => setState((s) => ({ ...s, debts: [...s.debts, debt] })),
    removeDebt: (id) => setState((s) => ({ ...s, debts: s.debts.filter((d) => d.id !== id) })),
    updateDebt: (id, patch) => setState((s) => ({ ...s, debts: s.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
  }), [state])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
