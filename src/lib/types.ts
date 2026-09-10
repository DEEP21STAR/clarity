// Core domain types for Clarity Budget Dashboard

export type Country = 'NZ' | 'AU'
export type Mode = 'personal' | 'business'
export type Period = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'
export type BillFrequency = 'weekly' | 'fortnightly' | 'monthly'
export type UpcomingWindow = 'week' | 'fortnight' | 'month'
export type HouseholdOwner = 'deep' | 'mimi' | 'shared'
export type HouseholdView = 'deep' | 'mimi' | 'combined'

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
  /** Who this bill belongs to, for the Household Deep/Mimi/Combined view. */
  owner: HouseholdOwner
  /** When owner === 'shared', the % of this bill attributed to Deep in individual household views/bill-split (rest goes to Mimi). Defaults to 50. */
  sharedSplitDeepPercent?: number
  /** The amount last saved before the most recent edit — used to detect and flag a price increase/change. Undefined until the first edit. */
  previousAmount?: number
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
  owner: HouseholdOwner
}

/** A plain device/goods repayment plan — no interest, no risk overlay. */
export interface DeviceRepayment {
  id: string
  name: string
  monthlyAmount: number
  remaining: number
  paymentsTotal: number
  paymentsRemaining: number
  owner: HouseholdOwner
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
  owner: HouseholdOwner
  sharedSplitDeepPercent?: number
}

/**
 * `liquid` accounts are real bank/cash-equivalent balances (HSBC, Overdraft,
 * Savings) — HSBC + Overdraft count toward Live Funds Available; Savings does
 * not (it's not meant to be spent day-to-day) but all three count in net worth.
 * `asset` accounts are manually-maintained non-liquid assets (Car, Home,
 * Other) — NEVER auto-valued from a live market API, always user-edited, and
 * the UI must say so honestly.
 */
export type AccountType = 'liquid' | 'asset'

export interface Account {
  id: string
  name: string
  type: AccountType
  value: number
  /** True for accounts that count toward Live Funds Available (HSBC, Overdraft) — false for Savings and all non-liquid assets. */
  countsTowardLiveFunds: boolean
  note?: string
}

/** One point-in-time net worth reading, snapshotted at most once per calendar day. */
export interface NetWorthSnapshot {
  date: string // ISO YYYY-MM-DD
  netWorth: number
  totalAssets: number
  totalLiabilities: number
}

export interface SavingsGoal {
  id: string
  name: string
  targetAmount: number
  targetDate?: string
  /** Total banked toward this goal so far (moved via "Log this period's contribution"). */
  contributedAmount: number
  /** $ set aside for this goal each Upcoming Payments period — deducted from Live Funds Available until logged. */
  fundedThisPeriod: number
}

/** A one-off (non-recurring) income or expense entry, feeding the cash-flow projection. */
export interface OneOffEntry {
  id: string
  date: string // ISO
  description: string
  amount: number // negative = expense, positive = income
  /** 'extraUsage' = logged via the dedicated "Extra Usage Purchase" field (Claude API overage etc, Round 20) — still feeds the same Cash-Flow Forecast as a general one-off, just shown in its own list. Undefined = general one-off. */
  category?: 'general' | 'extraUsage'
}

/**
 * Generalised sinking fund for ANY irregular/lump-sum expense (car WOF/rego,
 * Christmas, annual subscriptions, etc) — same fortnightly-smoothing math as
 * the Gas/Electricity periodic-bill gauges, without the utility-specific
 * billing-period/credit semantics. Deliberately its own lightweight type so
 * PeriodicBill (which models a real utility billing cycle) doesn't have to
 * be stretched to fit unrelated expenses.
 */
export interface SinkingFund {
  id: string
  name: string
  targetAmount: number
  targetDate: string // ISO — when the lump sum is actually due
  currentSaved: number
}

/** User-entered running spend against each Live Funds allocation category, for the spend-pace alert. Resets when the user clears it. */
export interface SpendTracker {
  food: number
  fuel: number
  personal: number
  /** ISO date this tracker started counting from (so pace can be computed against elapsed time). */
  periodStart: string
}

export interface StreakState {
  current: number
  best: number
  lastCheckedDate: string
  /** Milestones already celebrated this streak run, so the confetti only fires once per milestone. */
  milestonesHit: number[]
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

export type PaymentTargetType = 'recurringBill' | 'creditCard' | 'installmentPlan' | 'periodicBill' | 'deviceRepayment'

/**
 * Real payment history, not just a paid/unpaid boolean (Round 20 — expanded
 * mid-build after Deep's real GEM VISA $325 payment made the simpler binary
 * version insufficient: he needed to see the real due DATE, actually record
 * an amount+date payment that reduces the real balance, and later filter a
 * real history of what was paid when). One record per real payment made:
 * - `recurringBill`/`periodicBill` payments carry `dueDateIso` so a specific
 *   due-date instance can still be checked as "paid" (the old
 *   PaidBillRecord behaviour, now a special case of this).
 * - `creditCard`/`installmentPlan`/`deviceRepayment` payments reduce a real
 *   running balance (see applyPaymentToCard/Plan/Device in logic.ts) and
 *   don't tie to one dated instance — GEM VISA doesn't publish how it
 *   allocates a card payment across concurrent plans, so a card payment
 *   reduces the CARD's overall balance, not each plan individually
 *   (disclosed as a real scope boundary, not silently guessed).
 */
export interface PaymentRecord {
  id: string
  targetType: PaymentTargetType
  targetId: string
  /** Human-readable name snapshotted at payment time, so history still reads correctly even if the bill/card is later renamed. */
  targetLabel: string
  amount: number
  date: string // ISO — the real date the payment was made
  /** Only set for recurringBill/periodicBill payments — which specific due-date instance this counts against. */
  dueDateIso?: string
  note?: string
  recordedAt: string // ISO timestamp, for ordering same-day payments
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
