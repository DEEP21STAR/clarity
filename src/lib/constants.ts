import type { RecurringBill, TaxBracket, IncomeAnchor, CreditCardAccount, DeviceRepayment, PeriodicBill, Account } from './types'

/**
 * NZ income tax brackets — 2026-27 tax year (1 Apr 2026 - 31 Mar 2027).
 * Verified live via WebSearch 2026-09-10 (IRD schedule effective since the
 * bottom-three-bracket lift of 31 Jul 2024; unchanged into 2026-27).
 * Sources checked: salaries.co.nz, taxaccountants.co.nz, nztax.tools, aba.org.nz.
 */
export const NZ_TAX_BRACKETS: TaxBracket[] = [
  { upTo: 15600, rate: 0.105 },
  { upTo: 53500, rate: 0.175 },
  { upTo: 78100, rate: 0.30 },
  { upTo: 180000, rate: 0.33 },
  { upTo: null, rate: 0.39 },
]

/** NZ ACC Earner's Levy — 2026-27 rate, verified live 2026-09-10. */
export const NZ_ACC_LEVY_RATE = 0.0175
export const NZ_ACC_LEVY_CAP = 156641

/**
 * AU resident income tax brackets — 2026-27 income year (1 Jul 2026 - 30 Jun 2027).
 * Verified live via WebSearch 2026-09-10: new bottom rate cut from 16% to 15%
 * effective 1 Jul 2026. Sources checked: superguide.com.au, austax.tools, ozcalc.com.au.
 */
export const AU_TAX_BRACKETS: TaxBracket[] = [
  { upTo: 18200, rate: 0 },
  { upTo: 45000, rate: 0.15 },
  { upTo: 135000, rate: 0.30 },
  { upTo: 190000, rate: 0.37 },
  { upTo: null, rate: 0.45 },
]

/** AU Medicare levy — verified live 2026-09-10. */
export const AU_MEDICARE_LEVY_RATE = 0.02
export const AU_MEDICARE_LEVY_LOW_THRESHOLD = 28011 // single, 2026-27, phase-in

/** AU Low Income Tax Offset — verified live 2026-09-10 (2026-27 year). */
export const AU_LITO_MAX = 700
export const AU_LITO_FULL_THRESHOLD = 37500
export const AU_LITO_ZERO_THRESHOLD = 66667
// LITO phases out in two stages between the thresholds above.
export const AU_LITO_TAPER_STAGE1_END = 45000
export const AU_LITO_TAPER_RATE_1 = 0.05 // 5c per $1 from 37,500 to 45,000
export const AU_LITO_TAPER_RATE_2 = 0.015 // 1.5c per $1 from 45,000 to 66,667

/** GST rates */
export const NZ_GST_RATE = 0.15
export const AU_GST_RATE = 0.10

/**
 * Deep's real recurring bills. Gas and Electricity are NOT here — they're
 * usage-metered periodic bills now (see SEED_PERIODIC_BILLS below), tracked
 * with a projected-charge gauge and fortnightly smoothing instead of a flat
 * monthly figure. GEM VISA entries carry the real current minimum payments
 * (2026-09-10) — the richer per-plan breakdown lives in SEED_CREDIT_CARDS;
 * these RecurringBill rows exist only so the minimum payment counts as a
 * real recurring cash outflow in the Upcoming Payments window math.
 */
export const SEED_BILLS: RecurringBill[] = [
  { id: 'bill-rent', name: 'Rent', amount: 1960, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'housing', active: true, owner: 'shared' },
  {
    id: 'bill-internet-mobile', name: 'Internet & Mobile', amount: 147.25, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'utilities', active: true,
    note: 'Telstra Sep 2026 cycle: previous bill $96.66, payment received $150.00 CR, credit carried forward $53.34 CR, total new charges $200.59 → amount due $147.25. Will vary by cycle; due-day still a placeholder.',
    owner: 'shared',
  },
  { id: 'bill-water', name: 'Water', amount: 50, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'utilities', active: true, owner: 'shared' },
  { id: 'bill-spotify', name: 'Spotify', amount: 17.99, frequency: 'monthly', dueDay: 2, dueDayIsEstimate: false, category: 'subscription', active: true, owner: 'shared' },
  { id: 'bill-google-one', name: 'Google One', amount: 2.99, frequency: 'monthly', dueDay: 12, dueDayIsEstimate: false, category: 'subscription', active: true, owner: 'shared' },
  { id: 'bill-car-insurance', name: 'Car Insurance', amount: 140, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'insurance', active: true, owner: 'shared' },
  { id: 'bill-contents-home-insurance', name: 'Contents Home Insurance', amount: 60, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'insurance', active: true, owner: 'shared' },
  {
    id: 'bill-gem-visa-deep', name: 'GEM VISA Deep', amount: 305.33, frequency: 'monthly', dueDay: 17, dueDayIsEstimate: false, category: 'debt', active: true,
    note: 'Real minimum payment due 17 Sep 2026. Full card + plan breakdown is in the Installment Plans section below.',
    owner: 'deep',
  },
  {
    id: 'bill-gem-visa-mimi', name: 'GEM VISA Mimi', amount: 0, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'debt', active: true,
    note: 'No minimum payment currently required on this card. Two plans on it are already expired and accruing 29.99% p.a. — see Installment Plans below.',
    owner: 'mimi',
  },
]

/**
 * Household ownership is a judgment call for every bill except the two GEM
 * VISA rows (unambiguous — each card is explicitly Deep's or Mimi's). Every
 * other bill defaults to 'shared' at a 50/50 split — Deep gave no data on
 * who actually pays what, so this is the honest, correctable default (see
 * `sharedSplitDeepPercent` on each bill, editable per-bill in the UI).
 */

/**
 * Judgment call, not Deep's own number: a plan is flagged "Expiry Risk" (amber)
 * when its required-monthly-payment (remaining ÷ months remaining) is at or
 * above this figure. Chosen so Deep's real "Purchases Jun–Jul 2026" plan
 * ($5,119.73 / 4 months = $1,279.93/mo) flags, while his "Purchases May–Jun
 * 2026" plan ($1,762.22 / 3 months = $587.41/mo) does NOT — that plan is
 * elevated relative to his smaller plans but not in the same league. Adjust
 * this constant if it doesn't match Deep's real sense of "too much to pay."
 */
export const INSTALLMENT_AMBER_RISK_THRESHOLD_PER_MONTH = 1000

/** Real GEM VISA data, given directly by Deep 2026-09-10 (screenshots of Latitude's "My Plans" UI). */
export const SEED_CREDIT_CARDS: CreditCardAccount[] = [
  {
    id: 'card-gem-visa-deep',
    name: 'GEM VISA Deep',
    balance: 9900.25,
    availableToSpend: 299.75,
    minPayment: 305.33,
    minPaymentDueDate: '2026-09-17',
    rates: { purchase: 0.2899, cashAdvance: 0.2999, interestFreePlan: 0, expiredPlanRate: 0.2999 },
    plans: [
      { id: 'plan-deep-1', name: 'Purchases May–Jun 2026', total: 1915.99, remaining: 1762.22, monthsTotal: 6, monthsRemaining: 3, expired: false },
      { id: 'plan-deep-2', name: 'Purchases Jun–Jul 2026', total: 5119.73, remaining: 5119.73, monthsTotal: 6, monthsRemaining: 4, expired: false },
      { id: 'plan-deep-3', name: 'The Good Guys Hoppers CRO', total: 3167.00, remaining: 1230.21, monthsTotal: 50, monthsRemaining: 25, expired: false },
      { id: 'plan-deep-4', name: 'The Good Guys Online Store', total: 1208.00, remaining: 748.96, monthsTotal: 50, monthsRemaining: 29, expired: false },
    ],
    owner: 'deep',
  },
  {
    id: 'card-gem-visa-mimi',
    name: 'GEM VISA Mimi',
    balance: 3027.79,
    creditLimit: 4000,
    availableToSpend: 922.21,
    minPayment: 0,
    rates: { purchase: 0.2899, cashAdvance: 0.2999, interestFreePlan: 0, expiredPlanRate: 0.2999 },
    plans: [
      { id: 'plan-mimi-1', name: 'Gem Visa interest free #1', total: 302.50, remaining: 200.49, monthsTotal: 0, monthsRemaining: 0, expired: true },
      // Remaining ($644.01) is genuinely HIGHER than total ($519.37) — interest has already
      // accrued onto the balance since expiry. Shown honestly, never clamped to plan total.
      { id: 'plan-mimi-2', name: 'Gem Visa interest free #2', total: 519.37, remaining: 644.01, monthsTotal: 0, monthsRemaining: 0, expired: true },
    ],
    owner: 'mimi',
  },
]

/**
 * Real device repayment, given directly by Deep 2026-09-10. Plain repayment —
 * no interest, no risk styling. Owner not specified by Deep — defaulted to
 * 'shared' 50/50 as the honest, correctable assumption (editable if it's
 * really just one person's phone).
 */
export const SEED_DEVICE_REPAYMENTS: DeviceRepayment[] = [
  { id: 'device-galaxy-z-fold7', name: 'Galaxy Z Fold7', monthlyAmount: 44.70, remaining: 983.40, paymentsTotal: 36, paymentsRemaining: 22, owner: 'shared' },
]

/**
 * Real Gas + Electricity data, given directly by Deep 2026-09-10 (screenshots
 * of the Red Energy app). Deep wants to pay these in smoothed fortnightly
 * set-asides rather than a lump sum — see suggestedFortnightlySetAside() in
 * logic.ts, and note the smoothed amount is what feeds Upcoming Payments'
 * Live Funds Available math, not these lump figures (avoids double-counting).
 */
export const SEED_PERIODIC_BILLS: PeriodicBill[] = [
  {
    id: 'periodic-gas',
    name: 'Gas',
    pendingBill: { amount: 300.27, dueDate: '2026-09-17', periodStart: '2026-07-04', periodEnd: '2026-08-28' },
    gaugePeriodStart: '2026-08-29',
    gaugePeriodEnd: '2026-10-28',
    projectedCharge: 369.18,
    inCredit: false,
    creditAmount: 0,
    smoothingEnabled: true,
    owner: 'shared',
  },
  {
    id: 'periodic-electricity',
    name: 'Electricity',
    gaugePeriodStart: '2026-07-21',
    gaugePeriodEnd: '2026-10-20',
    projectedCharge: 341.97,
    inCredit: true,
    creditAmount: 82.70,
    smoothingEnabled: true,
    owner: 'shared',
  },
]

/**
 * Accounts — replaces the old flat HSBC/Overdraft/Savings balance list.
 * HSBC + Overdraft count toward Live Funds Available (the spendable buffer);
 * Savings and the three non-liquid assets do NOT (they're not meant to be
 * spent day-to-day) but all five count toward net worth. Car/Home/Other are
 * manually-maintained — there is no live market API wired in, by design;
 * Deep edits these himself and the UI says so.
 */
export const SEED_ACCOUNTS: Account[] = [
  { id: 'hsbc', name: 'HSBC', type: 'liquid', value: 0, countsTowardLiveFunds: true },
  { id: 'overdraft', name: 'Overdraft', type: 'liquid', value: 0, countsTowardLiveFunds: true },
  { id: 'savings', name: 'Savings', type: 'liquid', value: 0, countsTowardLiveFunds: false },
  { id: 'asset-car', name: 'Car', type: 'asset', value: 0, countsTowardLiveFunds: false, note: 'Manually maintained — no live market valuation.' },
  { id: 'asset-home', name: 'Home', type: 'asset', value: 0, countsTowardLiveFunds: false, note: 'Manually maintained — no live market valuation.' },
  { id: 'asset-other', name: 'Other', type: 'asset', value: 0, countsTowardLiveFunds: false, note: 'Manually maintained — no live market valuation.' },
]

/** Judgment call: the spend-pace alert flags a category once its spend-pace outruns elapsed-time-pace by more than this margin (10 percentage points). */
export const SPEND_PACE_ALERT_BUFFER = 0.10

/**
 * Judgment-call thresholds for the shared traffic-light due-date colour
 * system (`dueDateSeverity()` in logic.ts) — used by every bill/plan/due-date
 * UI element (Recurring Bills, Periodic Bill gauges, GEM VISA minimum
 * payments, Bill Calendar) so red/amber/green never drifts between
 * components. NOT Deep's own numbers — one constant each to retune.
 */
export const DUE_DATE_DANGER_WITHIN_DAYS = 2 // overdue, or due within this many days -> red
export const DUE_DATE_WARN_WITHIN_DAYS = 5 // due within this many days (outside the red window) -> amber

/** Financial health score component weights — see calcFinancialHealthScore() in logic.ts for the full documented formula. */
export const HEALTH_SCORE_WEIGHTS = {
  savingsRate: 0.30,
  debtToIncome: 0.25,
  billCoverage: 0.25,
  emergencyFund: 0.20,
}

export const CLARITY_PIN = '6304'

/**
 * Income anchor, given directly by Deep 2026-09-10: Friday 2026-09-11 is a
 * confirmed COMBINED payday ($600 weekly + $500 fortnightly bonus = $1,100).
 * Every other Friday from this anchor is combined; the Fridays in between are
 * weekly-only ($600). Computed by date math (see logic.ts), never hardcoded.
 */
export const INCOME_ANCHOR: IncomeAnchor = {
  anchorDate: '2026-09-11',
  weeklyAmount: 600,
  fortnightlyBonusAmount: 500,
}

export const TODAY_OVERRIDE = '2026-09-10' // real "today" per Deep, used only as a fallback reference
