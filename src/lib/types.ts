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
  /** Optional freeform context shown in the UI (e.g. a billing-cycle breakdown). */
  note?: string
}

/** One Latitude-style "plan" (interest-free installment plan) sitting inside a credit card. */
export interface InstallmentPlan {
  id: string
  name: string
  total: number
  /** Current remaining balance on the plan. Can exceed `total` if interest has accrued post-expiry — never clamp this. */
  remaining: number
  monthsTotal: number
  monthsRemaining: number
  /** True when the plan's interest-free term has lapsed and it is now accruing the card's Expired Plan Rate. */
  expired: boolean
}

export interface CardRates {
  purchase: number // decimal APR
  cashAdvance: number
  interestFreePlan: number
  expiredPlanRate: number
}

export interface CreditCardAccount {
  id: string
  name: string
  balance: number
  creditLimit?: number
  availableToSpend: number
  minPayment: number
  /** ISO date, or undefined when no minimum payment is currently required. */
  minPaymentDueDate?: string
  rates: CardRates
  plans: InstallmentPlan[]
}

/** A plain device/goods repayment plan — no interest, no risk overlay. */
export interface DeviceRepayment {
  id: string
  name: string
  monthlyAmount: number
  remaining: number
  paymentsTotal: number
  paymentsRemaining: number
}

/** A usage-metered periodic bill (power/gas style) with a projected-charge gauge and fortnightly smoothing. */
export interface PeriodicBill {
  id: string
  name: string
  /** The most recent ALREADY-BILLED lump sum, if one is currently due. */
  pendingBill?: { amount: number; dueDate: string; periodStart: string; periodEnd: string }
  /** The in-progress period the projection gauge represents. */
  gaugePeriodStart: string
  gaugePeriodEnd: string
  projectedCharge: number
  inCredit: boolean
  creditAmount: number
  /** When false, this bill's smoothed fortnightly amount is excluded from the Upcoming Payments funds math (informational only). Defaults to true. */
  smoothingEnabled: boolean
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
