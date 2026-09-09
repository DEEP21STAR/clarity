import type { RecurringBill, TaxBracket, IncomeAnchor } from './types'

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
 * Deep's real recurring bills, exact figures given directly 2026-09-10.
 * All due days default to 1st of month as a clearly-labelled ESTIMATE —
 * Deep will supply real due dates and correct these himself.
 */
export const SEED_BILLS: RecurringBill[] = [
  { id: 'bill-rent', name: 'Rent', amount: 1960, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'housing', active: true },
  { id: 'bill-gas', name: 'Gas', amount: 150, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'utilities', active: true },
  { id: 'bill-electricity', name: 'Electricity', amount: 100, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'utilities', active: true },
  { id: 'bill-internet-mobile', name: 'Internet & Mobile', amount: 200, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'utilities', active: true },
  { id: 'bill-water', name: 'Water', amount: 50, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'utilities', active: true },
  { id: 'bill-spotify', name: 'Spotify', amount: 17.99, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'subscription', active: true },
  { id: 'bill-google-storage', name: 'Google Storage', amount: 2.99, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'subscription', active: true },
  { id: 'bill-car-insurance', name: 'Car Insurance', amount: 140, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'insurance', active: true },
  { id: 'bill-contents-home-insurance', name: 'Contents Home Insurance', amount: 60, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'insurance', active: true },
  { id: 'bill-gem-visa-deep', name: 'GEM VISA Deep', amount: 350, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'debt', active: true },
  { id: 'bill-gem-visa-mimi', name: 'GEM VISA Mimi', amount: 200, frequency: 'monthly', dueDay: 1, dueDayIsEstimate: true, category: 'debt', active: true },
]

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
