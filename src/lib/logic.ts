import type { TaxBracket, Debt, RecurringBill, BillFrequency, UpcomingWindow, Transaction, InstallmentPlan, PeriodicBill } from './types'
import {
  NZ_TAX_BRACKETS, NZ_ACC_LEVY_RATE, NZ_ACC_LEVY_CAP,
  AU_TAX_BRACKETS, AU_MEDICARE_LEVY_RATE, AU_MEDICARE_LEVY_LOW_THRESHOLD,
  AU_LITO_MAX, AU_LITO_FULL_THRESHOLD, AU_LITO_TAPER_STAGE1_END, AU_LITO_TAPER_RATE_1, AU_LITO_TAPER_RATE_2,
  NZ_GST_RATE, AU_GST_RATE, INCOME_ANCHOR, INSTALLMENT_AMBER_RISK_THRESHOLD_PER_MONTH,
} from './constants'

// ---------------------------------------------------------------------------
// Progressive tax bracket math
// ---------------------------------------------------------------------------

/** Computes tax owed on `income` given a progressive bracket schedule. */
export function calcBracketTax(income: number, brackets: TaxBracket[]): number {
  if (income <= 0) return 0
  let tax = 0
  let lowerBound = 0
  for (const bracket of brackets) {
    const upperBound = bracket.upTo ?? Infinity
    if (income <= lowerBound) break
    const taxableInThisBracket = Math.min(income, upperBound) - lowerBound
    tax += taxableInThisBracket * bracket.rate
    lowerBound = upperBound
    if (income <= upperBound) break
  }
  return round2(tax)
}

export function nzIncomeTax(income: number): number {
  return calcBracketTax(income, NZ_TAX_BRACKETS)
}

export function nzAccLevy(income: number): number {
  const liable = Math.min(Math.max(income, 0), NZ_ACC_LEVY_CAP)
  return round2(liable * NZ_ACC_LEVY_RATE)
}

/** Total NZ deductions (income tax + ACC levy) and resulting net. */
export function nzNetIncome(grossAnnual: number) {
  const tax = nzIncomeTax(grossAnnual)
  const acc = nzAccLevy(grossAnnual)
  const net = round2(grossAnnual - tax - acc)
  return { gross: grossAnnual, tax, accLevy: acc, net }
}

export function auIncomeTax(income: number): number {
  return calcBracketTax(income, AU_TAX_BRACKETS)
}

export function auMedicareLevy(income: number): number {
  if (income <= AU_MEDICARE_LEVY_LOW_THRESHOLD) return 0
  return round2(income * AU_MEDICARE_LEVY_RATE)
}

/** AU Low Income Tax Offset — reduces tax payable only, two-stage taper. */
export function auLito(income: number): number {
  if (income <= AU_LITO_FULL_THRESHOLD) return AU_LITO_MAX
  if (income <= AU_LITO_TAPER_STAGE1_END) {
    const reduction = (income - AU_LITO_FULL_THRESHOLD) * AU_LITO_TAPER_RATE_1
    return Math.max(0, round2(AU_LITO_MAX - reduction))
  }
  const stage1Reduction = (AU_LITO_TAPER_STAGE1_END - AU_LITO_FULL_THRESHOLD) * AU_LITO_TAPER_RATE_1
  const afterStage1 = AU_LITO_MAX - stage1Reduction
  const stage2Reduction = (income - AU_LITO_TAPER_STAGE1_END) * AU_LITO_TAPER_RATE_2
  return Math.max(0, round2(afterStage1 - stage2Reduction))
}

export function auNetIncome(grossAnnual: number) {
  const grossTax = auIncomeTax(grossAnnual)
  const lito = auLito(grossAnnual)
  const taxAfterOffset = Math.max(0, round2(grossTax - lito))
  const medicare = auMedicareLevy(grossAnnual)
  const net = round2(grossAnnual - taxAfterOffset - medicare)
  return { gross: grossAnnual, tax: taxAfterOffset, lito, medicareLevy: medicare, net }
}

// ---------------------------------------------------------------------------
// GST
// ---------------------------------------------------------------------------

export function gstRate(country: 'NZ' | 'AU'): number {
  return country === 'NZ' ? NZ_GST_RATE : AU_GST_RATE
}

/** Given a GST-exclusive amount, returns the GST component and GST-inclusive total. */
export function gstOnExclusive(amountExGst: number, country: 'NZ' | 'AU') {
  const rate = gstRate(country)
  const gst = round2(amountExGst * rate)
  return { amountExGst: round2(amountExGst), gst, amountIncGst: round2(amountExGst + gst) }
}

/** Given a GST-inclusive amount, backs out the GST component and ex-GST amount. */
export function gstFromInclusive(amountIncGst: number, country: 'NZ' | 'AU') {
  const rate = gstRate(country)
  const amountExGst = round2(amountIncGst / (1 + rate))
  const gst = round2(amountIncGst - amountExGst)
  return { amountIncGst: round2(amountIncGst), gst, amountExGst }
}

// ---------------------------------------------------------------------------
// Home office / WFH deduction calculators
// ---------------------------------------------------------------------------

/** NZ IRD fixed-rate WFH square-metre-style hourly rate (illustrative, editable by user). */
export const NZ_WFH_FIXED_RATE_PER_HOUR = 0.79
/** AU ATO fixed-rate WFH cents-per-hour method. */
export const AU_WFH_FIXED_RATE_PER_HOUR = 0.70

export function calcWfhFixedRate(hoursPerWeek: number, weeksPerYear: number, ratePerHour: number): number {
  return round2(hoursPerWeek * weeksPerYear * ratePerHour)
}

export function calcWfhActualCost(costs: { heating: number; electricity: number; internet: number; other: number }, businessUsePercent: number): number {
  const total = costs.heating + costs.electricity + costs.internet + costs.other
  return round2(total * (businessUsePercent / 100))
}

// ---------------------------------------------------------------------------
// CSV bank-statement import — column auto-detection heuristic
// ---------------------------------------------------------------------------

export interface CsvColumnGuess {
  dateCol: number
  descriptionCol: number
  amountCol: number
  /** Present when debit/credit are split across two columns instead of one signed amount column. */
  debitCol?: number
  creditCol?: number
}

const DATE_HEADER_HINTS = ['date', 'transaction date', 'posted', 'value date']
const DESC_HEADER_HINTS = ['description', 'details', 'narrative', 'particulars', 'reference', 'memo', 'payee']
const AMOUNT_HEADER_HINTS = ['amount', 'value']
const DEBIT_HEADER_HINTS = ['debit', 'withdrawal', 'money out', 'out']
const CREDIT_HEADER_HINTS = ['credit', 'deposit', 'money in', 'in']

function looksLikeDate(v: string): boolean {
  if (!v) return false
  return /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(v.trim())
}

function looksLikeAmount(v: string): boolean {
  if (!v) return false
  return /^-?\$?\(?-?\d[\d,]*(\.\d+)?\)?$/.test(v.trim())
}

/**
 * Rebuilds the `guessCol()` heuristic: auto-detects which CSV columns hold the
 * date, description and amount(s) for an arbitrary bank export, using header
 * text matching first, then falling back to sampling data rows by shape.
 */
export function guessCol(header: string[], sampleRows: string[][]): CsvColumnGuess {
  const lowerHeader = header.map((h) => h.toLowerCase().trim())

  const findByHints = (hints: string[]): number => {
    for (const hint of hints) {
      const idx = lowerHeader.findIndex((h) => h.includes(hint))
      if (idx !== -1) return idx
    }
    return -1
  }

  let dateCol = findByHints(DATE_HEADER_HINTS)
  let descriptionCol = findByHints(DESC_HEADER_HINTS)
  let amountCol = findByHints(AMOUNT_HEADER_HINTS)
  const debitCol = findByHints(DEBIT_HEADER_HINTS)
  const creditCol = findByHints(CREDIT_HEADER_HINTS)

  const colCount = header.length

  // Fallback: sample data rows to guess by value shape when headers are missing/ambiguous.
  if (dateCol === -1) {
    for (let c = 0; c < colCount; c++) {
      const hits = sampleRows.filter((r) => looksLikeDate(r[c] ?? '')).length
      if (hits >= Math.ceil(sampleRows.length * 0.6)) { dateCol = c; break }
    }
  }
  if (amountCol === -1 && debitCol === -1 && creditCol === -1) {
    for (let c = 0; c < colCount; c++) {
      if (c === dateCol) continue
      const hits = sampleRows.filter((r) => looksLikeAmount(r[c] ?? '')).length
      if (hits >= Math.ceil(sampleRows.length * 0.6)) { amountCol = c; break }
    }
  }
  if (descriptionCol === -1) {
    // Pick the remaining column with the longest average text length — descriptions are prose.
    let bestCol = -1
    let bestAvgLen = -1
    for (let c = 0; c < colCount; c++) {
      if (c === dateCol || c === amountCol || c === debitCol || c === creditCol) continue
      const avgLen = sampleRows.reduce((sum, r) => sum + (r[c]?.length ?? 0), 0) / Math.max(1, sampleRows.length)
      if (avgLen > bestAvgLen) { bestAvgLen = avgLen; bestCol = c }
    }
    descriptionCol = bestCol === -1 ? 0 : bestCol
  }

  const guess: CsvColumnGuess = { dateCol: Math.max(dateCol, 0), descriptionCol: Math.max(descriptionCol, 0), amountCol }
  if (debitCol !== -1) guess.debitCol = debitCol
  if (creditCol !== -1) guess.creditCol = creditCol
  return guess
}

export function parseCsvAmount(raw: string): number {
  if (!raw) return 0
  let s = raw.trim().replace(/[$,]/g, '')
  let negative = false
  if (s.startsWith('(') && s.endsWith(')')) { negative = true; s = s.slice(1, -1) }
  const n = parseFloat(s)
  if (isNaN(n)) return 0
  return negative ? -Math.abs(n) : n
}

/** Splits a raw CSV text body into header + rows, tolerating commas inside quoted fields. */
export function parseCsvText(text: string): { header: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const parseLine = (line: string): string[] => {
    const cells: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === ',' && !inQuotes) { cells.push(cur); cur = '' } else { cur += ch }
    }
    cells.push(cur)
    return cells.map((c) => c.trim())
  }
  const [header, ...rows] = lines.map(parseLine)
  return { header: header ?? [], rows }
}

export function importTransactionsFromCsv(text: string, mode: 'personal' | 'business'): Transaction[] {
  const { header, rows } = parseCsvText(text)
  const sample = rows.slice(0, Math.min(20, rows.length))
  const guess = guessCol(header, sample)

  return rows.map((row, i) => {
    let amount = 0
    if (guess.debitCol !== undefined || guess.creditCol !== undefined) {
      const debit = guess.debitCol !== undefined ? parseCsvAmount(row[guess.debitCol] ?? '') : 0
      const credit = guess.creditCol !== undefined ? parseCsvAmount(row[guess.creditCol] ?? '') : 0
      amount = credit - Math.abs(debit)
    } else if (guess.amountCol !== -1) {
      amount = parseCsvAmount(row[guess.amountCol] ?? '')
    }
    return {
      id: `csv-${Date.now()}-${i}`,
      date: row[guess.dateCol] ?? '',
      description: row[guess.descriptionCol] ?? '',
      amount,
      category: 'uncategorised',
      mode,
    }
  })
}

// ---------------------------------------------------------------------------
// Debt amortization — avalanche order (highest APR first)
// ---------------------------------------------------------------------------

export interface AvalanchePlanEntry {
  debtId: string
  name: string
  monthsToPayoff: number
  totalInterestPaid: number
}

/**
 * Simulates paying off debts in avalanche order: minimums on everything, all
 * extra budget thrown at the highest-APR debt until it's cleared, then rolled
 * onto the next highest, etc.
 */
export function avalanchePlan(debts: Debt[], extraMonthlyBudget: number): { entries: AvalanchePlanEntry[]; totalMonths: number; totalInterest: number } {
  const working = debts
    .filter((d) => d.balance > 0)
    .map((d) => ({ ...d }))
    .sort((a, b) => b.apr - a.apr)

  const entries: AvalanchePlanEntry[] = working.map((d) => ({ debtId: d.id, name: d.name, monthsToPayoff: 0, totalInterestPaid: 0 }))
  let month = 0
  let extra = extraMonthlyBudget
  const MAX_MONTHS = 1200 // 100 years safety cap

  while (working.some((d) => d.balance > 0.005) && month < MAX_MONTHS) {
    month++
    let extraThisMonth = extra
    for (const d of working) {
      if (d.balance <= 0.005) continue
      const monthlyRate = d.apr / 12
      const interest = round2(d.balance * monthlyRate)
      const entry = entries.find((e) => e.debtId === d.id)!
      entry.totalInterestPaid = round2(entry.totalInterestPaid + interest)
      d.balance = round2(d.balance + interest)

      let payment = Math.min(d.minPayment, d.balance)
      // Highest-APR debt still with balance gets the extra budget too.
      const isTarget = working.find((x) => x.balance > 0.005) === d
      if (isTarget && extraThisMonth > 0) {
        const extraApplied = Math.min(extraThisMonth, d.balance - payment)
        payment += extraApplied
        extraThisMonth -= extraApplied
      }
      d.balance = round2(d.balance - payment)
      if (d.balance <= 0.005 && entry.monthsToPayoff === 0) entry.monthsToPayoff = month
    }
  }

  return {
    entries,
    totalMonths: month,
    totalInterest: round2(entries.reduce((s, e) => s + e.totalInterestPaid, 0)),
  }
}

// ---------------------------------------------------------------------------
// Rule-based insights engine
// ---------------------------------------------------------------------------

export interface Insight {
  id: string
  severity: 'info' | 'warning' | 'critical'
  message: string
}

export function generateInsights(params: {
  monthlyIncome: number
  monthlyExpenses: number
  bills: RecurringBill[]
  debts: Debt[]
  savingsBalance: number
}): Insight[] {
  const insights: Insight[] = []
  const { monthlyIncome, monthlyExpenses, bills, debts, savingsBalance } = params

  const savingsRate = monthlyIncome > 0 ? (monthlyIncome - monthlyExpenses) / monthlyIncome : 0
  if (savingsRate < 0) {
    insights.push({ id: 'overspend', severity: 'critical', message: `Spending exceeds income by $${Math.abs(round2((monthlyExpenses - monthlyIncome))).toFixed(2)} this month.` })
  } else if (savingsRate < 0.1) {
    insights.push({ id: 'low-savings-rate', severity: 'warning', message: `Savings rate is ${(savingsRate * 100).toFixed(1)}% — under the healthy 10-20% guideline.` })
  } else {
    insights.push({ id: 'healthy-savings-rate', severity: 'info', message: `Savings rate is a healthy ${(savingsRate * 100).toFixed(1)}%.` })
  }

  const activeBillsTotal = bills.filter((b) => b.active).reduce((s, b) => s + monthlyEquivalent(b.amount, b.frequency), 0)
  if (monthlyIncome > 0 && activeBillsTotal / monthlyIncome > 0.5) {
    insights.push({ id: 'high-fixed-costs', severity: 'warning', message: `Fixed bills consume ${((activeBillsTotal / monthlyIncome) * 100).toFixed(0)}% of monthly income.` })
  }

  const highestAprDebt = [...debts].sort((a, b) => b.apr - a.apr)[0]
  if (highestAprDebt && highestAprDebt.apr > 0.15) {
    insights.push({ id: 'high-interest-debt', severity: 'warning', message: `${highestAprDebt.name} is charging ${(highestAprDebt.apr * 100).toFixed(1)}% APR — prioritise this first (avalanche order).` })
  }

  if (savingsBalance <= 0) {
    insights.push({ id: 'no-savings-buffer', severity: 'warning', message: 'Savings balance is $0 — no buffer for unexpected costs yet.' })
  }

  return insights
}

// ---------------------------------------------------------------------------
// Period conversion helpers
// ---------------------------------------------------------------------------

export function monthlyEquivalent(amount: number, frequency: BillFrequency): number {
  switch (frequency) {
    case 'weekly': return round2((amount * 52) / 12)
    case 'fortnightly': return round2((amount * 26) / 12)
    case 'monthly': return round2(amount)
  }
}

export function convertPeriodAmount(monthlyAmount: number, period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'): number {
  const annual = monthlyAmount * 12
  switch (period) {
    case 'daily': return round2(annual / 365)
    case 'weekly': return round2(annual / 52)
    case 'monthly': return round2(monthlyAmount)
    case 'quarterly': return round2(annual / 4)
    case 'annual': return round2(annual)
  }
}

// ---------------------------------------------------------------------------
// Payday logic — real date-based, computed from the confirmed anchor Friday.
// Never a hardcoded lookup table.
// ---------------------------------------------------------------------------

export function parseIsoDateUTC(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export const MS_PER_DAY = 86400000
const MS_PER_WEEK = MS_PER_DAY * 7

/** True if `dateIso` is one of the alternating combined-pay Fridays, counting from the anchor. */
export function isCombinedPayday(dateIso: string, anchorIso: string = INCOME_ANCHOR.anchorDate): boolean {
  const date = parseIsoDateUTC(dateIso)
  const anchor = parseIsoDateUTC(anchorIso)
  const diffWeeks = Math.round((date.getTime() - anchor.getTime()) / MS_PER_WEEK)
  // Must land exactly on a whole-week offset from the anchor, and that offset must be even.
  const diffMs = date.getTime() - anchor.getTime()
  if (diffMs % MS_PER_WEEK !== 0) return false
  return ((diffWeeks % 2) + 2) % 2 === 0
}

export function isPayday(dateIso: string, anchorIso: string = INCOME_ANCHOR.anchorDate): boolean {
  const date = parseIsoDateUTC(dateIso)
  const anchor = parseIsoDateUTC(anchorIso)
  const diffMs = date.getTime() - anchor.getTime()
  return diffMs % MS_PER_WEEK === 0
}

/** Income landing on a given date: 0 if not a Friday-payday, $600 weekly-only, or $1,100 combined. */
export function incomeOnDate(dateIso: string): number {
  if (!isPayday(dateIso)) return 0
  return isCombinedPayday(dateIso)
    ? INCOME_ANCHOR.weeklyAmount + INCOME_ANCHOR.fortnightlyBonusAmount
    : INCOME_ANCHOR.weeklyAmount
}

/** Total income landing within [startIso, endIso] inclusive. */
export function totalIncomeInWindow(startIso: string, endIso: string): number {
  const start = parseIsoDateUTC(startIso)
  const end = parseIsoDateUTC(endIso)
  let total = 0
  for (let t = start.getTime(); t <= end.getTime(); t += MS_PER_DAY) {
    const iso = new Date(t).toISOString().slice(0, 10)
    total += incomeOnDate(iso)
  }
  return round2(total)
}

export function addDaysIso(dateIso: string, days: number): string {
  const d = parseIsoDateUTC(dateIso)
  return new Date(d.getTime() + days * MS_PER_DAY).toISOString().slice(0, 10)
}

export function windowLengthDays(window: UpcomingWindow): number {
  switch (window) {
    case 'week': return 7
    case 'fortnight': return 14
    case 'month': return 30
  }
}

/** Total bills due within [startIso, endIso], prorating monthly bills by day-count as an honest estimate. */
export function totalBillsInWindow(bills: RecurringBill[], startIso: string, endIso: string): number {
  const start = parseIsoDateUTC(startIso)
  const end = parseIsoDateUTC(endIso)
  const windowDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1

  let total = 0
  for (const bill of bills) {
    if (!bill.active) continue
    switch (bill.frequency) {
      case 'weekly':
        total += bill.amount * (windowDays / 7)
        break
      case 'fortnightly':
        total += bill.amount * (windowDays / 14)
        break
      case 'monthly':
        // Prorate by day-count against an average 30.44-day month — honest estimate,
        // since exact due-dates are still placeholders.
        total += bill.amount * (windowDays / 30.44)
        break
    }
  }
  return round2(total)
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// ---------------------------------------------------------------------------
// Installment plan severity (GEM VISA "My Plans" style tracker)
// ---------------------------------------------------------------------------

export type PlanSeverity = 'normal' | 'amber' | 'red'

/** Required monthly payment to clear a plan on schedule. Infinity when 0 months remain but a balance is still owed. */
export function requiredMonthlyPayment(plan: InstallmentPlan): number {
  if (plan.monthsRemaining <= 0) return plan.remaining > 0 ? Infinity : 0
  return round2(plan.remaining / plan.monthsRemaining)
}

/**
 * 'red' = plan is literally expired and accruing the card's real Expired Plan
 * Rate right now — unambiguous, unconditional.
 * 'amber' = still interest-free, but the required monthly payment is high
 * enough to flag ("Expiry Risk"). The exact cutoff (INSTALLMENT_AMBER_RISK_THRESHOLD_PER_MONTH)
 * is a judgment call, not a number Deep gave — see the comment on that constant.
 */
export function getPlanSeverity(plan: InstallmentPlan): PlanSeverity {
  if (plan.expired) return 'red'
  if (requiredMonthlyPayment(plan) >= INSTALLMENT_AMBER_RISK_THRESHOLD_PER_MONTH) return 'amber'
  return 'normal'
}

/** Percentage paid off, clamped to [0, 100] for progress-bar rendering (remaining can exceed total post-expiry — never shown as negative progress). */
export function planProgressPercent(plan: InstallmentPlan): number {
  if (plan.total <= 0) return 0
  const paidOff = ((plan.total - plan.remaining) / plan.total) * 100
  return Math.max(0, Math.min(100, round2(paidOff)))
}

// ---------------------------------------------------------------------------
// Periodic (usage-metered) bills — projected-charge gauge + fortnightly smoothing
// ---------------------------------------------------------------------------

/** Days between two ISO dates (endIso - startIso), can be negative. */
export function daysBetweenIso(startIso: string, endIso: string): number {
  const start = parseIsoDateUTC(startIso)
  const end = parseIsoDateUTC(endIso)
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY)
}

/** Days remaining until periodEndIso, clamped to 0 (never negative). */
export function daysRemainingInPeriod(periodEndIso: string, todayIso: string): number {
  return Math.max(0, daysBetweenIso(todayIso, periodEndIso))
}

/** How far through its billing period a periodic bill is, 0-100, for the gauge arc. */
export function periodProgressPercent(periodStartIso: string, periodEndIso: string, todayIso: string): number {
  const totalDays = daysBetweenIso(periodStartIso, periodEndIso)
  if (totalDays <= 0) return 100
  const elapsedDays = daysBetweenIso(periodStartIso, todayIso)
  return Math.max(0, Math.min(100, round2((elapsedDays / totalDays) * 100)))
}

const MIN_FORTNIGHTS_DIVISOR = 0.5 // guards against a blow-up when very close to period end

/** Fortnights remaining until period end, floored at MIN_FORTNIGHTS_DIVISOR so the suggested amount never spikes near the deadline. */
export function fortnightsRemaining(periodEndIso: string, todayIso: string): number {
  const days = daysRemainingInPeriod(periodEndIso, todayIso)
  return Math.max(days / 14, MIN_FORTNIGHTS_DIVISOR)
}

/**
 * Deep's own words: "I like to Pay small amounts fortnightly otherwise its a
 * big lump sum to pay." Suggested set-aside = (projected charge for the
 * in-progress period − any credit balance) ÷ fortnights remaining until the
 * period ends. Never negative.
 */
export function suggestedFortnightlySetAside(bill: PeriodicBill, todayIso: string): number {
  const net = Math.max(0, bill.projectedCharge - (bill.inCredit ? bill.creditAmount : 0))
  return round2(net / fortnightsRemaining(bill.gaugePeriodEnd, todayIso))
}

/**
 * The smoothed fortnightly contribution from periodic bills, prorated into a
 * [startIso, endIso] window the same way a fortnightly RecurringBill would be —
 * this is what feeds Live Funds Available, NOT the lump-sum due dates (which
 * stay visible on the gauge cards for context but are not double-counted here).
 */
export function totalPeriodicSmoothedInWindow(bills: PeriodicBill[], startIso: string, endIso: string, todayIso: string): number {
  const windowDays = daysBetweenIso(startIso, endIso) + 1
  let total = 0
  for (const bill of bills) {
    if (bill.smoothingEnabled === false) continue // excluded by request — informational only, not counted in funds math
    total += suggestedFortnightlySetAside(bill, todayIso) * (windowDays / 14)
  }
  return round2(total)
}
