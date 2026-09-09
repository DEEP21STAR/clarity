// Core domain types for Clarity Budget Dashboard

export type Country = 'NZ' | 'AU'
export type Mode = 'personal' | 'business'
export type Period = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'
export type BillFrequency = 'weekly' | 'fortnightly' | 'monthly'
export type UpcomingWindow = 'week' | 'fortnight' | 'month'

export interface TaxBracket {
  upTo: number | null // null = no upper bound
  rate: number // as decimal, e.g. 0.105
}

export interface RecurringBill {
  id: string
  name: string
  amount: number
  frequency: BillFrequency
  /** Day of month (1-31) the bill is estimated due, when frequency is 'monthly'. */
  dueDay: number
  /** Whether the due day is a real confirmed date or a placeholder estimate. */
  dueDayIsEstimate: boolean
  category: 'housing' | 'utilities' | 'insurance' | 'subscription' | 'debt' | 'other'
  active: boolean
}

export interface AccountBalance {
  id: 'hsbc' | 'overdraft' | 'savings'
  label: string
  value: number
  note?: string
}

export interface IncomeAnchor {
  /** ISO date (YYYY-MM-DD) of a confirmed COMBINED (weekly+fortnightly) payday. */
  anchorDate: string
  weeklyAmount: number
  fortnightlyBonusAmount: number
}

export interface Transaction {
  id: string
  date: string // ISO
  description: string
  amount: number // negative = expense, positive = income
  category: string
  mode: Mode
}

export interface Debt {
  id: string
  name: string
  balance: number
  apr: number // decimal, e.g. 0.1999
  minPayment: number
}

export interface WFHClaim {
  hoursPerWeek: number
  weeksPerYear: number
  method: 'fixed-rate' | 'actual-cost'
  fixedRatePerHour: number // country-specific
  actualCosts?: { heating: number; electricity: number; internet: number; other: number }
}
