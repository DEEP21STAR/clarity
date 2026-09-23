import type {
  TaxBracket, Debt, RecurringBill, BillFrequency, UpcomingWindow, Transaction, InstallmentPlan, PeriodicBill,
  Account, CreditCardAccount, NetWorthSnapshot, SinkingFund, OneOffEntry, SpendTracker, StreakState, HouseholdOwner, HouseholdView, Mode,
  PaymentRecord, DeviceRepayment, SavingsGoal, IncomeAnchor,
} from './types'
import {
  NZ_TAX_BRACKETS, NZ_ACC_LEVY_RATE, NZ_ACC_LEVY_CAP,
  AU_TAX_BRACKETS, AU_MEDICARE_LEVY_RATE, AU_MEDICARE_LEVY_LOW_THRESHOLD,
  AU_LITO_MAX, AU_LITO_FULL_THRESHOLD, AU_LITO_TAPER_STAGE1_END, AU_LITO_TAPER_RATE_1, AU_LITO_TAPER_RATE_2,
  NZ_GST_RATE, AU_GST_RATE, INCOME_ANCHOR, INSTALLMENT_AMBER_RISK_THRESHOLD_PER_MONTH,
  SPEND_PACE_ALERT_BUFFER, HEALTH_SCORE_WEIGHTS, DUE_DATE_DANGER_WITHIN_DAYS, DUE_DATE_WARN_WITHIN_DAYS,
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

/**
 * Coordinator follow-up — real gap Deep found live with 1472 real imported transactions:
 * "uncategorised" for every single one isn't useful. Best-effort pattern match against common
 * AU/NZ merchant and description keywords, ordered specific-before-general (checked in array
 * order, first match wins) — genuinely real coverage for common cases, "uncategorised" kept as
 * the honest fallback for anything that doesn't match, not the default for everything.
 */
const CATEGORY_KEYWORD_RULES: { category: string; keywords: string[] }[] = [
  { category: 'Fuel', keywords: ['AMPOL', 'BP ', 'CALTEX', 'SHELL', 'MOBIL', 'GULL', 'Z ENERGY', 'PETROL', 'FUEL', 'FREEDOM FUEL', '7-ELEVEN', '7 ELEVEN'] },
  { category: 'Groceries', keywords: ['WOOLWORTH', 'COLES', 'ALDI', 'IGA ', 'COUNTDOWN', 'NEW WORLD', 'PAK N SAVE', 'PAK\'NSAVE', 'FOODTOWN', 'SUPERMARKET', 'FOODSTUFFS'] },
  { category: 'Food', keywords: ['KFC', 'MCDONALD', 'SUBWAY', 'DOMINO', 'PIZZA', 'UBER EATS', 'UBER *EATS', 'MENULOG', 'DOORDASH', 'HUNGRY JACK', 'NANDO', 'BURGER', 'GRILL', 'CAFE', 'COFFEE', 'RESTAURANT', 'STARBUCKS'] },
  { category: 'Housing', keywords: ['RENT', 'PROPERTY MANAGEMENT', 'REAL ESTATE', 'LANDLORD', 'BODY CORPORATE', 'BODY CORP'] },
  { category: 'Internet & Mobile', keywords: ['SPARK', 'VODAFONE', 'TELSTRA', 'OPTUS', '2DEGREES', 'SKINNY', 'ONE NZ', 'TELECOM'] },
  { category: 'Bank Fees', keywords: ['INTEREST CHARGED', 'ACCOUNT FEE', 'HONOUR FEE', 'DISHONOUR', 'OVERDRAFT FEE', 'MONTHLY FEE', 'BANK FEE', 'LATE FEE'] },
  { category: 'Insurance', keywords: ['INSURANCE', ' AMI ', 'STATE INSURANCE', 'TOWER INSURANCE', 'SUNCORP', 'AA INSURANCE'] },
  { category: 'Subscriptions', keywords: ['NETFLIX', 'SPOTIFY', 'DISNEY+', 'DISNEY PLUS', 'YOUTUBE PREMIUM', 'APPLE.COM/BILL', 'GOOGLE *', 'AMAZON PRIME', 'ANYTIME FITNESS', ' GYM ', 'CLAUDE.AI', 'CHATGPT', 'OPENAI'] },
  { category: 'Transport', keywords: ['UBER *TRIP', 'UBER TRIP', 'TAXI', 'PARKING', 'TOLL', 'AT HOP', 'METLINK', 'TRANSPORTNSW'] },
  { category: 'Shopping', keywords: ['KMART', 'TARGET', 'THE WAREHOUSE', 'BUNNINGS', 'HARVEY NORMAN', 'JB HI-FI', 'JB HIFI', 'AMAZON', 'EBAY', 'THE GOOD GUYS', 'BIG W'] },
  { category: 'Health', keywords: ['PHARMACY', 'CHEMIST', 'MEDICAL CENTRE', 'MEDICAL CENTER', 'DOCTOR', 'DENTIST', 'UNICHEM', 'LIFE PHARMACY', 'CHEMIST WAREHOUSE'] },
  { category: 'Income', keywords: ['SALARY', 'PAYROLL', 'WAGES'] },
  { category: 'Entertainment', keywords: ['CINEMA', 'EVENTFINDA', 'TICKETEK', 'TICKETMASTER', 'HOYTS', 'EVENT CINEMAS'] },
]

export function guessTransactionCategory(description: string): string {
  const upper = ` ${description.toUpperCase()} `
  for (const rule of CATEGORY_KEYWORD_RULES) {
    if (rule.keywords.some((kw) => upper.includes(kw.toUpperCase()))) return rule.category
  }
  return 'uncategorised'
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
    const description = row[guess.descriptionCol] ?? ''
    return {
      id: `csv-${Date.now()}-${i}`,
      date: row[guess.dateCol] ?? '',
      description,
      amount,
      category: guessTransactionCategory(description),
      mode,
    }
  })
}

// ---------------------------------------------------------------------------
// Debt amortization — avalanche order (highest APR first)
// ---------------------------------------------------------------------------

/**
 * Coordinator follow-up, real architectural gap Deep found: GEM VISA card balances (real
 * debt, real APR already tracked per card) lived entirely in the Installment Plan
 * Tracker/Upcoming Payments data model, completely invisible to the Debts tab's Total
 * Debt/avalanche/months-to-debt-free calculator — so that calculator answered "when will I
 * be debt-free" while genuinely not knowing about Deep's actual biggest debts.
 *
 * Maps every credit card carrying a real balance into a Debt-shaped entry so it flows through
 * the SAME avalanchePlan()/avalanchePayoffTimeline() math as any manually-entered debt, using
 * `rates.purchase` as the card's real ongoing APR (the standard revolving rate — the same
 * `purchase` rate calcNetWorth() already treats `balance` as the card's full liability
 * figure, so this doesn't double-count against anything). Deliberately does NOT also add each
 * card's individual installment PLANS as separate debts — a plan's `remaining` is already
 * part of the card's overall `balance` in this data model (confirmed against
 * calcNetWorth/applyPaymentToCard, which only ever reads/writes the card-level `balance`),
 * so adding both would double-count the same real dollars twice.
 */
export function creditCardsAsDebts(creditCards: CreditCardAccount[]): Debt[] {
  return creditCards
    .filter((c) => c.balance > 0)
    .map((c) => ({
      id: `card-debt-${c.id}`,
      name: c.name,
      balance: c.balance,
      apr: c.rates.purchase,
      // Real bug found live via the actual avalanche simulation, not assumed: a card whose
      // `minPayment` is genuinely $0 this billing cycle (e.g. GEM VISA Mimi — real data, "None
      // due" right now) still carries a real balance that keeps accruing real interest every
      // month. avalanchePlan()/avalanchePayoffTimeline() pay each debt's OWN minPayment every
      // month regardless of whether it's the current avalanche target — feeding a literal $0
      // meant this balance was NEVER paid down while some other debt was still being targeted,
      // and once its accrued interest grew large enough to outpace the (possibly zero, if it's
      // never the target) extra-budget contribution, the simulation genuinely diverged —
      // confirmed live: GEM VISA Mimi's projected interest reached $3.6 QUADRILLION at the
      // 1200-month safety cap. Same real fallback this codebase already uses for expired
      // installment plans with no published minimum (see planPayoffWithExtra's baselinePayment)
      // — max($25, 2% of balance) — a genuine, if approximate, real-world minimum-payment floor.
      minPayment: c.minPayment > 0 ? c.minPayment : Math.max(25, round2(c.balance * 0.02)),
    }))
}

export interface AvalanchePlanEntry {
  debtId: string
  name: string
  monthsToPayoff: number
  totalInterestPaid: number
}

export type PayoffStrategy = 'avalanche' | 'snowball'

/** Shared ordering for both avalanchePlan and avalanchePayoffTimeline — avalanche targets the
 * highest APR first (mathematically minimizes total interest paid); snowball targets the
 * smallest balance first (clears individual debts faster, a real behavioral-motivation
 * tradeoff over the mathematically optimal choice). Default preserves every existing call
 * site's exact prior behavior. */
export function sortForStrategy<T extends Debt>(debts: T[], strategy: PayoffStrategy): T[] {
  return strategy === 'snowball' ? [...debts].sort((a, b) => a.balance - b.balance) : [...debts].sort((a, b) => b.apr - a.apr)
}

/**
 * Simulates paying off debts in avalanche (default) or snowball order: minimums on everything,
 * all extra budget thrown at the current target debt until it's cleared, then rolled onto the
 * next one, etc.
 */
export function avalanchePlan(debts: Debt[], extraMonthlyBudget: number, strategy: PayoffStrategy = 'avalanche'): { entries: AvalanchePlanEntry[]; totalMonths: number; totalInterest: number } {
  const working = sortForStrategy(debts.filter((d) => d.balance > 0).map((d) => ({ ...d })), strategy)

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

export interface AvalancheTimelinePoint {
  month: number
  totalBalance: number
  /** Per-debt balance at this month — feeds the snowball visualization (each debt's own falling line). */
  balances: Record<string, number>
}

/**
 * Same exact simulation as avalanchePlan() (interest accrual, minimums,
 * highest-APR-first extra payment) but returns a month-by-month balance
 * SERIES instead of just the final totals — for the real payoff timeline
 * chart and the "snowball" per-debt visualization (#6/#7). Deliberately a
 * separate function rather than refactoring avalanchePlan() itself, so the
 * existing tested behaviour there can't regress.
 */
export function avalanchePayoffTimeline(debts: Debt[], extraMonthlyBudget: number, strategy: PayoffStrategy = 'avalanche'): AvalancheTimelinePoint[] {
  const working = sortForStrategy(debts.filter((d) => d.balance > 0).map((d) => ({ ...d })), strategy)
  if (working.length === 0) return []

  const snapshot = (m: number): AvalancheTimelinePoint => ({
    month: m,
    totalBalance: round2(working.reduce((s, d) => s + Math.max(0, d.balance), 0)),
    balances: Object.fromEntries(working.map((d) => [d.id, round2(Math.max(0, d.balance))])),
  })

  const points: AvalancheTimelinePoint[] = [snapshot(0)]
  let month = 0
  const extra = extraMonthlyBudget
  const MAX_MONTHS = 1200

  while (working.some((d) => d.balance > 0.005) && month < MAX_MONTHS) {
    month++
    let extraThisMonth = extra
    for (const d of working) {
      if (d.balance <= 0.005) continue
      const interest = round2(d.balance * (d.apr / 12))
      d.balance = round2(d.balance + interest)
      let payment = Math.min(d.minPayment, d.balance)
      const isTarget = working.find((x) => x.balance > 0.005) === d
      if (isTarget && extraThisMonth > 0) {
        const extraApplied = Math.min(extraThisMonth, d.balance - payment)
        payment += extraApplied
        extraThisMonth -= extraApplied
      }
      d.balance = round2(d.balance - payment)
    }
    points.push(snapshot(month))
  }
  return points
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

/**
 * 2026-09-23 — `anchor` param makes this genuinely per-instance (the wizard's "Go to
 * Dashboard" needs a client's OWN pay pattern, not Deep's), while staying 100% backward
 * compatible: every existing call site that doesn't pass one keeps getting Deep's real
 * INCOME_ANCHOR, byte-identical to before this change.
 */
export function incomeOnDate(dateIso: string, anchor: IncomeAnchor = INCOME_ANCHOR): number {
  if (!isPayday(dateIso, anchor.anchorDate)) return 0
  return isCombinedPayday(dateIso, anchor.anchorDate)
    ? anchor.weeklyAmount + anchor.fortnightlyBonusAmount
    : anchor.weeklyAmount
}

/** Total income landing within [startIso, endIso] inclusive. */
export function totalIncomeInWindow(startIso: string, endIso: string, anchor: IncomeAnchor = INCOME_ANCHOR): number {
  const start = parseIsoDateUTC(startIso)
  const end = parseIsoDateUTC(endIso)
  let total = 0
  for (let t = start.getTime(); t <= end.getTime(); t += MS_PER_DAY) {
    const iso = new Date(t).toISOString().slice(0, 10)
    total += incomeOnDate(iso, anchor)
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

/**
 * Total bills due within [startIso, endIso], prorating monthly bills by
 * day-count as an honest estimate. `view` defaults to 'combined' (full
 * amount, original behaviour) — pass 'deep'/'mimi' to get that person's
 * household-attributed share instead (shared bills split per-bill, see
 * `householdShare()`).
 */
export function totalBillsInWindow(bills: RecurringBill[], startIso: string, endIso: string, view: HouseholdView = 'combined'): number {
  const start = parseIsoDateUTC(startIso)
  const end = parseIsoDateUTC(endIso)
  const windowDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1

  let total = 0
  for (const bill of bills) {
    if (!bill.active) continue
    const amount = householdShare(bill.amount, bill.owner, bill.sharedSplitDeepPercent, view)
    switch (bill.frequency) {
      case 'weekly':
        total += amount * (windowDays / 7)
        break
      case 'fortnightly':
        total += amount * (windowDays / 14)
        break
      case 'monthly':
        // Prorate by day-count against an average 30.44-day month — honest estimate,
        // since exact due-dates are still placeholders.
        total += amount * (windowDays / 30.44)
        break
    }
  }
  return round2(total)
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * 2026-09-23 — real quick-log spend, dated today, for the given category, within the current
 * window (same [startIso, endIso] convention as totalBillsInWindow/totalIncomeInWindow above).
 * Sums the absolute value of negative-amount entries only — a category quick-log is always an
 * expense; a stray positive entry in one of these categories (shouldn't happen via the UI, but
 * cheap to guard) is ignored rather than silently reducing the total spend.
 */
export function totalQuickLogSpendInWindow(
  entries: OneOffEntry[],
  category: 'food' | 'fuel' | 'personal',
  startIso: string,
  endIso: string
): number {
  const start = parseIsoDateUTC(startIso)
  const end = parseIsoDateUTC(endIso)
  let total = 0
  for (const e of entries) {
    if (e.category !== category || e.amount >= 0) continue
    const d = parseIsoDateUTC(e.date)
    if (d.getTime() < start.getTime() || d.getTime() > end.getTime()) continue
    total += -e.amount
  }
  return round2(total)
}

// ---------------------------------------------------------------------------
// #1, Round 20 — deterministic colour-from-category-string for Transactions
// (CSV-imported categories are free text, not the fixed RecurringBill
// category enum, so a fixed lookup table can't cover them — a stable hash
// picks the same colour for the same category every render/reload without
// needing to know the category set in advance).
// ---------------------------------------------------------------------------

const TRANSACTION_CATEGORY_PALETTE = ['#22d3ee', '#a855f7', '#ec4899', '#34d399', '#f59e0b', '#60a5fa', '#f472b6', '#4ade80']

export function categoryColor(category: string): string {
  let hash = 0
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) >>> 0
  }
  return TRANSACTION_CATEGORY_PALETTE[hash % TRANSACTION_CATEGORY_PALETTE.length]
}

// ---------------------------------------------------------------------------
// #3/#48, Round 20 — live search match ranges, shared by Transactions' row
// search and the unified ⌘K search (case-insensitive, ALL occurrences, not
// just the first).
// ---------------------------------------------------------------------------

export function findMatchRanges(text: string, query: string): [number, number][] {
  if (!query.trim()) return []
  const ranges: [number, number][] = []
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  let start = 0
  while (start <= lowerText.length) {
    const idx = lowerText.indexOf(lowerQuery, start)
    if (idx === -1) break
    ranges.push([idx, idx + lowerQuery.length])
    start = idx + lowerQuery.length
  }
  return ranges
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

// ---------------------------------------------------------------------------
// Shared traffic-light due-date colour system — ONE function, reused by every
// bill/plan/due-date UI element (Recurring Bills, Periodic Bill gauges, GEM
// VISA minimum payments, Bill Calendar) so red/amber/green can never drift
// out of sync between components, and always recomputes from real "today"
// rather than being set once and going stale.
// ---------------------------------------------------------------------------

export type DueSeverity = 'ok' | 'warn' | 'danger'

/** daysUntil may be negative (already overdue). Thresholds documented in constants.ts — judgment calls, not Deep's own numbers. */
export function dueDateSeverity(daysUntil: number): DueSeverity {
  if (daysUntil <= DUE_DATE_DANGER_WITHIN_DAYS) return 'danger'
  if (daysUntil <= DUE_DATE_WARN_WITHIN_DAYS) return 'warn'
  return 'ok'
}

/** Full-phrase label for a traffic-light badge, e.g. "3 days overdue" / "due today" / "due in 6 days". */
export function dueInLabel(daysUntil: number): string {
  if (daysUntil < 0) {
    const overdue = Math.abs(daysUntil)
    return `${overdue} day${overdue === 1 ? '' : 's'} overdue`
  }
  if (daysUntil === 0) return 'due today'
  if (daysUntil === 1) return 'due tomorrow'
  return `due in ${daysUntil} days`
}

/**
 * Real paid/unpaid tracking (#8, Round 20) — a recurring/periodic bill's
 * due-date instance is "paid" when a real PaymentRecord exists against it.
 * This is what lets the Bill Calendar upgrade its Round 19 "already passed
 * this month = neutral" guess into a real answer: a paid instance is
 * genuinely done regardless of date; an unpaid PAST instance is genuinely
 * overdue, not a guess.
 */
export function isBillInstancePaid(records: PaymentRecord[], billId: string, dueDateIso: string): boolean {
  return records.some((r) => r.targetId === billId && r.dueDateIso === dueDateIso)
}

// ---------------------------------------------------------------------------
// #8 expanded, Round 20 — real payment recording that reduces the actual
// balance/remaining amount, not just a boolean. Each apply* function is a
// pure, symmetric delta: calling it with a NEGATIVE amount exactly reverses
// a positive application (used by the store's deletePaymentRecord for a
// real Undo), except where a genuinely irreversible state change already
// happened (a periodic bill's pendingBill cleared to undefined — see the
// comment on applyPaymentToPeriodicBill).
// ---------------------------------------------------------------------------

export function applyPaymentToCard(card: CreditCardAccount, amount: number): CreditCardAccount {
  const newBalance = round2(Math.max(0, card.balance - amount))
  const newAvailable = card.creditLimit !== undefined
    ? round2(Math.min(card.creditLimit, card.availableToSpend + amount))
    : round2(card.availableToSpend + amount)
  return { ...card, balance: newBalance, availableToSpend: newAvailable }
}

export function applyPaymentToPlan(plan: InstallmentPlan, amount: number): InstallmentPlan {
  return { ...plan, remaining: round2(Math.max(0, plan.remaining - amount)) }
}

/**
 * Real calendar month subtraction (not -30 days) — mirrors nextMonthlyDueDate()'s day-of-month
 * clamping, just running backward. Used below as the ONLY reasonable cycle-start estimate
 * available from this data model: a card only ever stores its NEXT minPaymentDueDate, not a
 * stored statement/cycle-open date, so "one real calendar month before the next due date" is
 * the honest approximation of "since the last due date."
 */
function oneMonthBefore(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const targetMonthIndex = m - 2 // m is 1-indexed; -1 for 0-indexing, -1 again to go back a month
  const daysInTargetMonth = new Date(Date.UTC(y, targetMonthIndex + 1, 0)).getUTCDate()
  const day = Math.min(d, daysInTargetMonth)
  return new Date(Date.UTC(y, targetMonthIndex, day)).toISOString().slice(0, 10)
}

export interface MinPaymentCycleStatus {
  met: boolean
  cycleStart: string | null
  cycleToDatePayments: number
  remaining: number
}

/**
 * Coordinator follow-up, real gap Deep found: he recorded a real $325 payment against GEM VISA
 * Deep (balance correctly dropped), but the card's "Min Payment $305.33" section didn't
 * change at all — because nothing was tracking payments against the minimum at all. A minimum
 * payment is a per-billing-cycle requirement (satisfied once enough has been paid against it
 * THIS cycle), not a running balance to literally subtract from — so this is deliberately NOT
 * `applyPaymentToCard`'s "reduce a number" pattern.
 *
 * Cycle boundary: since the last due date (approximated as one real calendar month before the
 * card's current `minPaymentDueDate` — see oneMonthBefore()'s doc comment for why), or every
 * real payment on record for this card if there's no due date to anchor a cycle to at all (a
 * card with `minPayment <= 0` never reaches that branch — see the early return below).
 */
export function minPaymentCycleStatus(
  card: Pick<CreditCardAccount, 'id' | 'minPayment' | 'minPaymentDueDate'>,
  paymentRecords: PaymentRecord[],
  todayIsoStr: string
): MinPaymentCycleStatus {
  if (card.minPayment <= 0) return { met: true, cycleStart: null, cycleToDatePayments: 0, remaining: 0 }
  const cycleStart = card.minPaymentDueDate ? oneMonthBefore(card.minPaymentDueDate) : null
  const cycleToDatePayments = round2(
    paymentRecords
      .filter((r) => r.targetType === 'creditCard' && r.targetId === card.id)
      .filter((r) => (!cycleStart || r.date >= cycleStart) && r.date <= todayIsoStr)
      .reduce((s, r) => s + r.amount, 0)
  )
  return {
    met: cycleToDatePayments >= card.minPayment,
    cycleStart,
    cycleToDatePayments,
    remaining: Math.max(0, round2(card.minPayment - cycleToDatePayments)),
  }
}

/**
 * A payment >= the pending bill's amount clears it entirely (any excess
 * becomes real credit, using the same inCredit/creditAmount fields the
 * gauge already understands) — a partial payment just reduces the pending
 * amount. NOTE: once cleared (pendingBill undefined), this is a no-op on
 * reversal — a deleted payment record can't resurrect the original pending
 * bill's exact dates, a real, disclosed limitation, not a silent bug.
 */
export function applyPaymentToPeriodicBill(bill: PeriodicBill, amount: number): PeriodicBill {
  if (!bill.pendingBill) return bill
  const newAmount = round2(bill.pendingBill.amount - amount)
  if (newAmount <= 0) {
    const overpaid = round2(Math.abs(newAmount))
    return {
      ...bill,
      pendingBill: undefined,
      inCredit: overpaid > 0 ? true : bill.inCredit,
      creditAmount: overpaid > 0 ? round2(bill.creditAmount + overpaid) : bill.creditAmount,
    }
  }
  return { ...bill, pendingBill: { ...bill.pendingBill, amount: newAmount } }
}

/** paymentsRemaining is adjusted by the caller (store.tsx), not here, since reversal needs the opposite +1/-1 and this function alone can't tell direction from `amount`'s sign reliably at 0. */
export function applyPaymentToDevice(device: DeviceRepayment, amount: number): DeviceRepayment {
  return { ...device, remaining: round2(Math.max(0, device.remaining - amount)) }
}

export interface PaymentHistoryFilter {
  targetId?: string
  startDate?: string
  endDate?: string
}

/** Shared filter logic — the SAME function/component pattern every payment-history view in the app reuses, per Deep's explicit "filters need to apply to all areas" instruction. */
export function filterPaymentRecords(records: PaymentRecord[], filter: PaymentHistoryFilter): PaymentRecord[] {
  return records
    .filter((r) => {
      if (filter.targetId && r.targetId !== filter.targetId) return false
      if (filter.startDate && r.date < filter.startDate) return false
      if (filter.endDate && r.date > filter.endDate) return false
      return true
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt))
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
export function totalPeriodicSmoothedInWindow(bills: PeriodicBill[], startIso: string, endIso: string, todayIso: string, view: HouseholdView = 'combined'): number {
  const windowDays = daysBetweenIso(startIso, endIso) + 1
  let total = 0
  for (const bill of bills) {
    if (bill.smoothingEnabled === false) continue // excluded by request — informational only, not counted in funds math
    const smoothed = suggestedFortnightlySetAside(bill, todayIso)
    total += householdShare(smoothed, bill.owner, bill.sharedSplitDeepPercent, view) * (windowDays / 14)
  }
  return round2(total)
}

// ---------------------------------------------------------------------------
// PHASE 1 — Net worth
// ---------------------------------------------------------------------------

export interface NetWorthBreakdown {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
}

/**
 * Net worth = sum(all account values, liquid + non-liquid assets) − sum(all
 * liabilities: every credit card's real balance + every tracked Debt's balance).
 * Overdraft is treated as an asset-side buffer (its `value` represents
 * available/positive buffer, consistent with how it already feeds Live Funds
 * Available) — it is never double-subtracted as a liability here.
 */
export function calcNetWorth(accounts: Account[], creditCards: CreditCardAccount[], debts: Debt[]): NetWorthBreakdown {
  const totalAssets = round2(accounts.reduce((s, a) => s + a.value, 0))
  const totalLiabilities = round2(
    creditCards.reduce((s, c) => s + c.balance, 0) + debts.reduce((s, d) => s + d.balance, 0)
  )
  return { totalAssets, totalLiabilities, netWorth: round2(totalAssets - totalLiabilities) }
}

/** Inserts/updates today's net worth snapshot — at most one entry per calendar day, so history doesn't grow unbounded. */
export function upsertNetWorthSnapshot(history: NetWorthSnapshot[], snapshot: NetWorthSnapshot): NetWorthSnapshot[] {
  const existingIdx = history.findIndex((h) => h.date === snapshot.date)
  if (existingIdx === -1) return [...history, snapshot].sort((a, b) => a.date.localeCompare(b.date))
  const next = [...history]
  next[existingIdx] = snapshot
  return next
}

/** Judgment call, not Deep's own number: a net worth "milestone" is crossing a $10k round threshold. */
export const NET_WORTH_MILESTONE_STEP = 10000

export interface NetWorthMilestone {
  date: string
  netWorth: number
  threshold: number
}

/**
 * #11, Round 20 — real milestone-crossing points for the Net Worth trend
 * line's flag markers. Only counts UPWARD crossings (dropping back below a
 * threshold and climbing back through it does not re-fire the same
 * milestone), sorted chronologically same as the history itself.
 */
export function netWorthMilestones(history: NetWorthSnapshot[]): NetWorthMilestone[] {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date))
  const hits: NetWorthMilestone[] = []
  let lastThresholdCrossed = -Infinity
  let prevNetWorth: number | null = null
  for (const h of sorted) {
    if (prevNetWorth !== null) {
      const prevStep = Math.floor(prevNetWorth / NET_WORTH_MILESTONE_STEP)
      const curStep = Math.floor(h.netWorth / NET_WORTH_MILESTONE_STEP)
      if (curStep > prevStep && curStep > 0) {
        const threshold = curStep * NET_WORTH_MILESTONE_STEP
        if (threshold > lastThresholdCrossed) {
          hits.push({ date: h.date, netWorth: h.netWorth, threshold })
          lastThresholdCrossed = threshold
        }
      }
    }
    prevNetWorth = h.netWorth
  }
  return hits
}

// ---------------------------------------------------------------------------
// #24/#45, Round 20 — real trend-arrow direction, shared by every "vs last
// period" comparison in the app (Net Worth, health score, category spend).
// ---------------------------------------------------------------------------

export type TrendDirection = 'up' | 'down' | 'flat'

export function trendDirection(current: number, previous: number): TrendDirection {
  if (current > previous) return 'up'
  if (current < previous) return 'down'
  return 'flat'
}

/** Real percent change vs a previous value — returns null when previous is 0 (a % change is meaningless from a zero base, not "invented" as some huge number). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return round2(((current - previous) / Math.abs(previous)) * 100)
}

// ---------------------------------------------------------------------------
// PHASE 2.1 — Forward cash-flow projection
// ---------------------------------------------------------------------------

/**
 * Monthly bills fire on their real `dueDay`, clamped to the actual length of
 * that month (e.g. a dueDay of 31 fires on the 28th/29th/30th in short months).
 * Weekly/fortnightly bills have no stored weekday in this data model (none of
 * Deep's real bills are weekly/fortnightly today) — as a documented, honest
 * convention they're assumed to fire every Monday (weekly) or every other
 * Monday counting from 2026-01-05, the first Monday of 2026 (fortnightly).
 * This only matters if/when a weekly or fortnightly bill is ever added.
 */
const FORTNIGHTLY_BILL_EPOCH_MONDAY = '2026-01-05'

function isMonday(dateIso: string): boolean {
  return parseIsoDateUTC(dateIso).getUTCDay() === 1
}

function dailyRecurringBillCharge(bills: RecurringBill[], dateIso: string): number {
  const [, m, d] = dateIso.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(Number(dateIso.slice(0, 4)), m, 0)).getUTCDate()
  let total = 0
  for (const bill of bills) {
    if (!bill.active) continue
    if (bill.frequency === 'monthly') {
      const effectiveDueDay = Math.min(bill.dueDay, daysInMonth)
      if (d === effectiveDueDay) total += bill.amount
    } else if (bill.frequency === 'weekly') {
      if (isMonday(dateIso)) total += bill.amount
    } else if (bill.frequency === 'fortnightly') {
      if (isMonday(dateIso) && isCombinedPayday(dateIso, FORTNIGHTLY_BILL_EPOCH_MONDAY)) total += bill.amount
    }
  }
  return total
}

function dailyPeriodicSmoothedCharge(bills: PeriodicBill[], dateIso: string): number {
  let total = 0
  for (const bill of bills) {
    if (bill.smoothingEnabled === false) continue
    total += suggestedFortnightlySetAside(bill, dateIso) / 14
  }
  return round2(total)
}

function dailyOneOffCharge(entries: OneOffEntry[], dateIso: string): number {
  return round2(entries.filter((e) => e.date === dateIso).reduce((s, e) => s + e.amount, 0))
}

export interface ProjectedBalancePoint {
  date: string
  balance: number
}

/**
 * Rolling day-by-day projected balance: starts at `startBalance` on `startDateIso`
 * and walks forward `days` days, applying real payday income, monthly bills on
 * their actual due-day, periodic bills' smoothed daily contribution, and any
 * one-off entries. This is the same engines already built (payday, bills,
 * periodic smoothing) — just walked day-by-day instead of summed over a window.
 */
// 2026-09-23 round 8 — real bug found while building the what-if simulator: this never took
// an income anchor parameter at all, so it always used the module-level default INCOME_ANCHOR
// (Deep's own real weekly/fortnightly-bonus pattern) regardless of what a wizard-onboarded
// account's OWN incomeAnchor actually is. Any account set up through the real onboarding flow
// (round 5) has been getting a Cash-Flow Forecast computed against the wrong income pattern
// since that flow shipped. Default preserves every existing call site's exact prior behavior.
export function projectBalanceSeries(
  startBalance: number,
  startDateIso: string,
  days: number,
  bills: RecurringBill[],
  periodicBills: PeriodicBill[],
  oneOffEntries: OneOffEntry[],
  anchor: IncomeAnchor = INCOME_ANCHOR
): ProjectedBalancePoint[] {
  const points: ProjectedBalancePoint[] = []
  let balance = startBalance
  for (let i = 0; i < days; i++) {
    const dateIso = addDaysIso(startDateIso, i)
    const income = incomeOnDate(dateIso, anchor)
    const billCharge = dailyRecurringBillCharge(bills, dateIso)
    const periodicCharge = dailyPeriodicSmoothedCharge(periodicBills, dateIso)
    const oneOff = dailyOneOffCharge(oneOffEntries, dateIso)
    balance = round2(balance + income - billCharge - periodicCharge + oneOff)
    points.push({ date: dateIso, balance })
  }
  return points
}

// ---------------------------------------------------------------------------
// PHASE 2.4 — Financial health score
// ---------------------------------------------------------------------------

export interface HealthScoreInputs {
  savingsRate: number // decimal, e.g. 0.15 = 15%
  debtToIncome: number // total debt balance ÷ annual net income, decimal
  billCoverageRatio: number // monthly net income ÷ monthly fixed bills
  emergencyFundMonths: number // savings balance ÷ average monthly fixed bills
}

export interface HealthScoreResult {
  score: number // 0-100, rounded to whole number
  breakdown: { savingsRate: number; debtToIncome: number; billCoverage: number; emergencyFund: number } // each component's 0-100 sub-score
}

/**
 * Financial Health Score — the ONE number Deep will trust most, so the exact
 * formula is documented here rather than buried in code:
 *
 *   score = 100 × [
 *     0.30 × clamp(savingsRate / 0.20, 0, 1)                     (20% savings rate = full marks)
 *   + 0.25 × clamp(1 − debtToIncome / 1.0, 0, 1)                 (debt = 1x annual income = zero marks; 0 debt = full marks)
 *   + 0.25 × clamp((billCoverageRatio − 1) / 1, 0, 1)            (barely covering bills (ratio 1.0) = zero marks; 2x coverage = full marks)
 *   + 0.20 × clamp(emergencyFundMonths / 6, 0, 1)                (6 months' expenses saved = full marks — the standard financial-advice benchmark)
 *   ]
 *
 * Weights (30/25/25/20) and the four benchmark constants above (20% savings
 * rate, 1x income debt ceiling, 2x bill coverage, 6-month emergency fund) are
 * this build's judgment calls, not Deep's own numbers — reasonable, widely-
 * cited financial-planning rules of thumb, adjustable in `constants.ts`
 * (HEALTH_SCORE_WEIGHTS) and here if Deep wants different benchmarks.
 */
export function calcFinancialHealthScore(inputs: HealthScoreInputs): HealthScoreResult {
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
  const savingsRateScore = clamp01(inputs.savingsRate / 0.20) * 100
  const debtToIncomeScore = clamp01(1 - inputs.debtToIncome / 1.0) * 100
  const billCoverageScore = clamp01((inputs.billCoverageRatio - 1) / 1) * 100
  const emergencyFundScore = clamp01(inputs.emergencyFundMonths / 6) * 100

  const score = Math.round(
    savingsRateScore * HEALTH_SCORE_WEIGHTS.savingsRate +
    debtToIncomeScore * HEALTH_SCORE_WEIGHTS.debtToIncome +
    billCoverageScore * HEALTH_SCORE_WEIGHTS.billCoverage +
    emergencyFundScore * HEALTH_SCORE_WEIGHTS.emergencyFund
  )

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: {
      savingsRate: round2(savingsRateScore),
      debtToIncome: round2(debtToIncomeScore),
      billCoverage: round2(billCoverageScore),
      emergencyFund: round2(emergencyFundScore),
    },
  }
}

// ---------------------------------------------------------------------------
// PHASE 2.7 — Emergency fund coverage
// ---------------------------------------------------------------------------

export function emergencyFundMonths(savingsBalance: number, avgMonthlyBills: number): number {
  if (avgMonthlyBills <= 0) return 0
  return round2(savingsBalance / avgMonthlyBills)
}

/**
 * Round 21, item #17 — the health score already turns emergency-fund coverage into a 0-6-month
 * sub-score, but a bare number of months is abstract. This converts it into a real calendar
 * date ("covers you until 14 Mar 2027"), using an average month length (365.25/12 = 30.4375
 * days) rather than assuming every month is exactly 30 days, so the date stays accurate across
 * a multi-year runway. Returns null when there's no real runway to project (zero/negative
 * months, or no bills to divide by at all).
 */
export function emergencyFundRunwayDate(months: number, fromDateIso: string): string | null {
  if (months <= 0) return null
  const days = Math.round(months * (365.25 / 12))
  if (days <= 0) return null
  return addDaysIso(fromDateIso, days)
}

// ---------------------------------------------------------------------------
// Round 21, item #11 — duplicate-subscription detector
// ---------------------------------------------------------------------------

export interface DuplicateBillWarning {
  a: RecurringBill
  b: RecurringBill
}

/**
 * Flags active bill pairs that look like an accidental duplicate — e.g. a subscription
 * re-added after being forgotten, or a bill entered twice during CSV/manual setup. Two
 * signals, either one sufficient:
 *   1. Identical name (case/whitespace-insensitive) + same frequency — a literal duplicate
 *      regardless of amount (a same-named active bill twice is suspicious on its own).
 *   2. Related name (one name contains the other, both >= 4 chars to avoid short
 *      false-positive substrings like "TV") + same frequency + amounts within $1.50 — catches
 *      "Netflix" vs "Netflix Premium" at the same real price, but NOT "Netflix" $9.99 vs
 *      "Netflix Premium" $24.99 (a real price difference means these are plausibly both real).
 * Deliberately conservative — a false "you might have a duplicate" nag is worse than missing
 * an edge case, so unrelated names never trigger this just because they share a frequency or
 * a coincidentally equal amount.
 */
export interface DataHealthFinding {
  id: string
  severity: 'warning' | 'info'
  message: string
}

/**
 * Round 21, item #10 — real data-integrity self-check, surfaced in Tools. Four genuine
 * categories of "this is probably a mistake, not a real financial fact": likely duplicate
 * subscriptions (item #11, via findLikelyDuplicateBills below), an active bill still sitting
 * at $0 (setup started but never finished), a credit card balance that's somehow bigger than
 * its own stated credit limit (a typo in one of the two numbers), and a non-Overdraft liquid
 * account sitting negative (Overdraft is the only account expected to ever go negative).
 * Deliberately NOT a financial-health opinion (that's Insights) — every finding here is a
 * plain data-consistency fact, checkable without any judgment call about what's "healthy".
 */
export function runDataHealthCheck(params: {
  bills: RecurringBill[]
  creditCards: CreditCardAccount[]
  accounts: Account[]
}): DataHealthFinding[] {
  const { bills, creditCards, accounts } = params
  const findings: DataHealthFinding[] = []

  for (const d of findLikelyDuplicateBills(bills)) {
    findings.push({
      id: `dup-${d.a.id}-${d.b.id}`,
      severity: 'warning',
      message: `"${d.a.name}" and "${d.b.name}" look like possible duplicates (both active, ${d.a.frequency}) — check they're not the same bill entered twice.`,
    })
  }

  for (const b of bills) {
    if (b.active && b.amount === 0) {
      findings.push({ id: `zero-amount-${b.id}`, severity: 'info', message: `"${b.name}" is active with a $0 amount — likely still needs its real amount filled in.` })
    }
  }

  for (const c of creditCards) {
    if (c.creditLimit !== undefined && c.balance > c.creditLimit) {
      findings.push({
        id: `overlimit-${c.id}`,
        severity: 'warning',
        message: `${c.name}'s balance ($${c.balance.toFixed(2)}) exceeds its stated credit limit ($${c.creditLimit.toFixed(2)}) — check for a typo in either figure.`,
      })
    }
  }

  for (const a of accounts) {
    if (a.type === 'liquid' && a.id !== 'overdraft' && a.value < 0) {
      findings.push({ id: `negative-${a.id}`, severity: 'warning', message: `${a.name} has a negative balance ($${a.value.toFixed(2)}) — only Overdraft is expected to go negative.` })
    }
  }

  return findings
}

export function findLikelyDuplicateBills(bills: RecurringBill[]): DuplicateBillWarning[] {
  const active = bills.filter((b) => b.active)
  const warnings: DuplicateBillWarning[] = []
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]
      const b = active[j]
      if (a.frequency !== b.frequency) continue
      const an = a.name.trim().toLowerCase()
      const bn = b.name.trim().toLowerCase()
      const sameName = an === bn && an.length > 0
      const relatedName = an.length >= 4 && bn.length >= 4 && (an.includes(bn) || bn.includes(an))
      const closeAmount = Math.abs(a.amount - b.amount) <= 1.5
      if (sameName || (relatedName && closeAmount)) warnings.push({ a, b })
    }
  }
  return warnings
}

/**
 * Wires the raw app-state fields into calcFinancialHealthScore()'s inputs —
 * extracted so store.tsx's daily snapshot effect, Dashboard.tsx's headline
 * score, and AmbientBackground's health-reactive particles (#22, Round 20)
 * all compute the SAME current score the SAME way, instead of three
 * separately-maintained copies of this wiring drifting apart over time.
 */
export function computeCurrentHealthScore(params: {
  bills: RecurringBill[]
  creditCards: CreditCardAccount[]
  debts: Debt[]
  accounts: Account[]
  grossAnnualIncome: number
  country: 'NZ' | 'AU'
}): HealthScoreResult {
  const { bills, creditCards, debts, accounts, grossAnnualIncome, country } = params
  const net = country === 'NZ' ? nzNetIncome(grossAnnualIncome) : auNetIncome(grossAnnualIncome)
  const monthlyNet = net.net / 12
  const monthlyBills = bills.filter((b) => b.active).reduce((s, b) => s + monthlyEquivalent(b.amount, b.frequency), 0)
  const savingsBalance = accounts.find((a) => a.id === 'savings')?.value ?? 0
  const savingsRate = monthlyNet > 0 ? (monthlyNet - monthlyBills) / monthlyNet : 0
  const totalDebtBalance = debts.reduce((s, d) => s + d.balance, 0) + creditCards.reduce((s, c) => s + c.balance, 0)
  const debtToIncome = net.net > 0 ? totalDebtBalance / net.net : 1
  const billCoverageRatio = monthlyBills > 0 ? monthlyNet / monthlyBills : 2
  const efMonths = emergencyFundMonths(savingsBalance, monthlyBills)
  return calcFinancialHealthScore({ savingsRate, debtToIncome, billCoverageRatio, emergencyFundMonths: efMonths })
}

// ---------------------------------------------------------------------------
// PHASE 2.6 — What-if extra-payment slider on an installment plan
// ---------------------------------------------------------------------------

export interface PlanPayoffResult {
  months: number
  totalInterest: number
}

/**
 * How many months to clear a plan given an extra $/month on top of its
 * required minimum, and the resulting total interest paid.
 *
 * Interest-free active plans (apr effectively 0): purely arithmetic —
 * months = ceil(remaining ÷ (requiredMonthly + extra)). No interest.
 *
 * Expired plans (charging the card's real Expired Plan Rate): simulated
 * month-by-month compounding. Latitude doesn't expose a per-plan minimum
 * payment once a plan has expired (only a card-level minimum), so a baseline
 * payment of max($25, 2% of remaining balance) is assumed here — a standard,
 * conservative minimum-payment convention, not a number Latitude gave us;
 * documented as an assumption for Deep to sanity-check against his real
 * statement if he uses this slider on an expired plan.
 */
export function planPayoffWithExtra(plan: InstallmentPlan, extraPerMonth: number, apr: number = 0): PlanPayoffResult {
  if (!plan.expired || apr <= 0) {
    const payment = requiredMonthlyPayment(plan) + extraPerMonth
    if (payment <= 0) return { months: Infinity, totalInterest: 0 }
    return { months: Math.ceil(plan.remaining / payment), totalInterest: 0 }
  }

  // Expired plan — real compounding interest simulation.
  const baselinePayment = Math.max(25, plan.remaining * 0.02)
  const monthlyPayment = baselinePayment + extraPerMonth
  const monthlyRate = apr / 12
  let balance = plan.remaining
  let months = 0
  let totalInterest = 0
  const MAX_MONTHS = 600
  while (balance > 0.005 && months < MAX_MONTHS) {
    const interest = round2(balance * monthlyRate)
    totalInterest = round2(totalInterest + interest)
    balance = round2(balance + interest)
    const payment = Math.min(monthlyPayment, balance)
    if (payment <= 0) break // no progress possible, avoid an infinite loop
    balance = round2(balance - payment)
    months++
  }
  return { months, totalInterest }
}

// ---------------------------------------------------------------------------
// PHASE 2.8 — Household Deep/Mimi/Combined split
// ---------------------------------------------------------------------------

/** The $ amount of a shared-owner item attributed to a specific household view. 'combined' always gets the full amount. */
function householdShare(amount: number, owner: HouseholdOwner, sharedSplitDeepPercent: number | undefined, view: HouseholdView): number {
  if (view === 'combined') return amount
  if (owner === view) return amount
  if (owner === 'shared') {
    const deepPct = sharedSplitDeepPercent ?? 50
    return view === 'deep' ? round2(amount * (deepPct / 100)) : round2(amount * ((100 - deepPct) / 100))
  }
  return 0 // owned by the other person, not shared — contributes nothing to this view
}

/** Sum of monthly-equivalent bill amounts attributed to a household view. deep-view-total + mimi-view-total === combined-view-total exactly (shared bills split, never double-counted). */
export function totalBillsForHousehold(bills: RecurringBill[], view: HouseholdView): number {
  return round2(
    bills
      .filter((b) => b.active)
      .reduce((s, b) => s + householdShare(monthlyEquivalent(b.amount, b.frequency), b.owner, b.sharedSplitDeepPercent, view), 0)
  )
}

/** Sum of credit card balances attributed to a household view. */
export function totalCardBalanceForHousehold(cards: CreditCardAccount[], view: HouseholdView): number {
  return round2(cards.reduce((s, c) => s + householdShare(c.balance, c.owner, undefined, view), 0))
}

// ---------------------------------------------------------------------------
// PHASE 2.9 — Generalised sinking funds (any irregular/lump-sum expense)
// ---------------------------------------------------------------------------

/**
 * Same smoothing math as suggestedFortnightlySetAside() but generalised to
 * ANY irregular lump-sum expense (car WOF/rego, Christmas, annual subs) —
 * no utility-billing-period/credit semantics, just target amount, target
 * date, and what's already saved.
 */
export function suggestedFortnightlyForSinkingFund(fund: SinkingFund, todayIso: string): number {
  const net = Math.max(0, fund.targetAmount - fund.currentSaved)
  return round2(net / fortnightsRemaining(fund.targetDate, todayIso))
}

export function totalSinkingFundsSmoothedInWindow(funds: SinkingFund[], startIso: string, endIso: string, todayIso: string): number {
  const windowDays = daysBetweenIso(startIso, endIso) + 1
  return round2(funds.reduce((s, f) => s + suggestedFortnightlyForSinkingFund(f, todayIso) * (windowDays / 14), 0))
}

// ---------------------------------------------------------------------------
// PHASE 2.11 — Predictive spend-pace alert
// ---------------------------------------------------------------------------

export interface SpendPaceAlert {
  category: 'food' | 'fuel' | 'personal'
  pctElapsed: number
  pctSpent: number
}

/**
 * Flags a category when its spend-pace is outrunning the elapsed-time-pace
 * of the current window by more than SPEND_PACE_ALERT_BUFFER (10 points) —
 * e.g. 40% of the week elapsed but 60% of the Fuel allocation already spent.
 */
export function calcSpendPaceAlerts(
  tracker: SpendTracker,
  allocation: { food: number; fuel: number; personal: number },
  windowStartIso: string,
  windowEndIso: string,
  todayIso: string
): SpendPaceAlert[] {
  const totalWindowDays = daysBetweenIso(windowStartIso, windowEndIso) + 1
  const elapsedDays = Math.max(0, Math.min(totalWindowDays, daysBetweenIso(windowStartIso, todayIso) + 1))
  const pctElapsed = totalWindowDays > 0 ? elapsedDays / totalWindowDays : 0

  const alerts: SpendPaceAlert[] = []
  for (const category of ['food', 'fuel', 'personal'] as const) {
    const allocated = allocation[category]
    const spent = tracker[category]
    const pctSpent = allocated > 0 ? spent / allocated : 0
    if (pctSpent - pctElapsed > SPEND_PACE_ALERT_BUFFER) {
      alerts.push({ category, pctElapsed: round2(pctElapsed * 100), pctSpent: round2(pctSpent * 100) })
    }
  }
  return alerts
}

// ---------------------------------------------------------------------------
// PHASE 2.12 — Round-up savings simulator (simulation only, moves no money)
// ---------------------------------------------------------------------------

export function calcRoundUpSavings(transactions: Transaction[], roundTo: number = 5): number {
  return round2(
    transactions
      .filter((t) => t.amount < 0)
      .reduce((s, t) => {
        const abs = Math.abs(t.amount)
        const roundedUp = Math.ceil(abs / roundTo) * roundTo
        return s + (roundedUp - abs)
      }, 0)
  )
}

export interface YearInReview {
  totalPaid: number
  paymentCount: number
  netWorthChange: number | null // null when there isn't yet a year-ago snapshot to compare against
  netWorthStart: number | null
  netWorthNow: number | null
  bestStreak: number
  goalsCompleted: number
  goalsTotal: number
}

/**
 * #44, Round 20 — real "financial year in review" recap, computed from
 * actual state (paymentRecords, netWorthHistory, streak, savingsGoals), not
 * invented. Deliberately a rolling last-365-days window rather than picking
 * a specific NZ (Apr-Mar) or AU (Jul-Jun) fiscal year — Deep didn't specify
 * which convention, and a rolling window is honest and unambiguous
 * regardless of the NZ/AU country toggle.
 */
export function buildYearInReview(params: {
  paymentRecords: PaymentRecord[]
  netWorthHistory: NetWorthSnapshot[]
  streak: StreakState
  savingsGoals: SavingsGoal[]
  todayIso: string
}): YearInReview {
  const { paymentRecords, netWorthHistory, streak, savingsGoals, todayIso: today } = params
  const yearAgoIso = addDaysIso(today, -365)

  const recentPayments = paymentRecords.filter((r) => r.date >= yearAgoIso)
  const totalPaid = round2(recentPayments.reduce((s, r) => s + r.amount, 0))

  const sortedHistory = [...netWorthHistory].sort((a, b) => a.date.localeCompare(b.date))
  const netWorthNow = sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1].netWorth : null
  const yearAgoEntry = sortedHistory.find((h) => h.date >= yearAgoIso) ?? sortedHistory[0] ?? null
  const netWorthStart = yearAgoEntry ? yearAgoEntry.netWorth : null
  const netWorthChange = netWorthNow !== null && netWorthStart !== null ? round2(netWorthNow - netWorthStart) : null

  const goalsCompleted = savingsGoals.filter((g) => g.targetAmount > 0 && g.contributedAmount >= g.targetAmount).length

  return {
    totalPaid,
    paymentCount: recentPayments.length,
    netWorthChange,
    netWorthStart,
    netWorthNow,
    bestStreak: streak.best,
    goalsCompleted,
    goalsTotal: savingsGoals.length,
  }
}

/** Judgment call: a category month-over-month change smaller than this is noise, not a real "trend" worth surfacing. */
export const CATEGORY_TREND_INSIGHT_THRESHOLD_PERCENT = 5

/**
 * #45, Round 20 — real trend-arrow-backed textual insights ("Fuel spend up
 * 12% vs last month"), computed from actual monthlySpendByCategory() data,
 * not invented. Only fires for categories with at least 2 real months of
 * data and a change big enough to matter (see the threshold above).
 */
export function generateCategoryTrendInsights(series: CategoryMonthlySeries[]): Insight[] {
  const insights: Insight[] = []
  for (const s of series) {
    if (s.points.length < 2) continue
    const latest = s.points[s.points.length - 1]
    const previous = s.points[s.points.length - 2]
    const pct = percentChange(latest.total, previous.total)
    if (pct === null || Math.abs(pct) < CATEGORY_TREND_INSIGHT_THRESHOLD_PERCENT) continue
    const dir = trendDirection(latest.total, previous.total)
    insights.push({
      id: `trend-${s.category}`,
      severity: dir === 'up' ? 'warning' : 'info',
      message: `${s.category} spend ${dir} ${Math.abs(pct).toFixed(0)}% vs last month (${formatCurrency2(previous.total)} → ${formatCurrency2(latest.total)}).`,
    })
  }
  return insights
}

function formatCurrency2(n: number): string {
  return `$${n.toFixed(2)}`
}

// ---------------------------------------------------------------------------
// #5, Round 20 — real month-over-month spend trend PER CATEGORY, from actual
// imported transactions. Deliberately separate from the existing Bill
// Category Breakdown donut (which sums the fixed RecurringBill category
// enum) — a CSV-imported Transaction.category is free text with no
// guaranteed overlap with that enum, so blending them would fabricate a
// match between two different taxonomies. Honest empty state when there's
// no transaction history to trend yet.
// ---------------------------------------------------------------------------

export interface CategoryMonthlySeries {
  category: string
  points: { month: string; total: number }[] // month = 'YYYY-MM'
}

export function monthlySpendByCategory(transactions: Transaction[]): CategoryMonthlySeries[] {
  const byCategory = new Map<string, Map<string, number>>()
  for (const t of transactions) {
    if (t.amount >= 0) continue // spend only — income doesn't belong in a "category spend trend"
    const month = t.date.slice(0, 7)
    if (!byCategory.has(t.category)) byCategory.set(t.category, new Map())
    const monthMap = byCategory.get(t.category)!
    monthMap.set(month, round2((monthMap.get(month) ?? 0) + Math.abs(t.amount)))
  }
  return Array.from(byCategory.entries())
    .map(([category, monthMap]) => ({
      category,
      points: Array.from(monthMap.entries())
        .map(([month, total]) => ({ month, total }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    }))
    .sort((a, b) => {
      const totalA = a.points.reduce((s, p) => s + p.total, 0)
      const totalB = b.points.reduce((s, p) => s + p.total, 0)
      return totalB - totalA // biggest spender first
    })
}

// ---------------------------------------------------------------------------
// PHASE 2.5 — Bill price-increase detection
// ---------------------------------------------------------------------------

export function isBillAmountChanged(bill: RecurringBill): boolean {
  return bill.previousAmount !== undefined && bill.previousAmount !== bill.amount
}

/** Pure helper for the store's updateBill mutator: when the amount is genuinely changing, remembers the old value as `previousAmount` so the UI can flag it. */
export function applyBillAmountChange(bill: RecurringBill, newAmount: number): Partial<RecurringBill> {
  if (newAmount === bill.amount) return {}
  return { amount: newAmount, previousAmount: bill.amount }
}

// ---------------------------------------------------------------------------
// PHASE 2.17 — Savings streaks
// ---------------------------------------------------------------------------

const STREAK_MILESTONES = [7, 30, 100]

/**
 * Advances the streak once per real calendar day the app is opened. If no
 * spend-pace alert fired "today" (i.e. `staidOnPace` is true), the streak
 * continues; otherwise it resets to 0. Honest limitation: a day the app is
 * never opened isn't checked — this is a client-only SPA with no backend to
 * run a scheduled daily check, so the streak only advances on days Deep
 * actually visits.
 */
export function updateStreak(streak: StreakState, staidOnPace: boolean, todayIso: string): { streak: StreakState; newMilestone: number | null } {
  if (streak.lastCheckedDate === todayIso) return { streak, newMilestone: null } // already checked today

  const current = staidOnPace ? streak.current + 1 : 0
  const best = Math.max(streak.best, current)
  const milestonesHit = staidOnPace ? streak.milestonesHit : []
  let newMilestone: number | null = null
  if (staidOnPace) {
    for (const m of STREAK_MILESTONES) {
      if (current >= m && !milestonesHit.includes(m)) {
        milestonesHit.push(m)
        newMilestone = m
      }
    }
  }
  return { streak: { current, best, lastCheckedDate: todayIso, milestonesHit }, newMilestone }
}

// ---------------------------------------------------------------------------
// Data export — full JSON (feature 14) and accountant CSV (feature 15)
// ---------------------------------------------------------------------------

export function buildAccountantCsv(transactions: Transaction[], mode: Mode, periodLabel: string): string {
  const filtered = transactions.filter((t) => t.mode === mode)
  const byCategory = new Map<string, number>()
  for (const t of filtered) {
    byCategory.set(t.category, round2((byCategory.get(t.category) ?? 0) + t.amount))
  }
  const totalIncome = round2(filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0))
  const totalExpenses = round2(filtered.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0))

  const lines: string[] = []
  lines.push(`Clarity — Accountant Summary,${mode === 'personal' ? 'Personal' : 'Business'},${periodLabel}`)
  lines.push('')
  lines.push('Category,Total')
  for (const [category, total] of byCategory.entries()) {
    lines.push(`${category},${total.toFixed(2)}`)
  }
  lines.push('')
  lines.push('Summary,')
  lines.push(`Total Income,${totalIncome.toFixed(2)}`)
  lines.push(`Total Expenses,${totalExpenses.toFixed(2)}`)
  lines.push(`Net,${round2(totalIncome + totalExpenses).toFixed(2)}`)
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Live insights ticker — real, rotating messages pulled from the actual data
// model, not placeholder copy.
// ---------------------------------------------------------------------------

export function nextMonthlyDueDate(dueDay: number, todayIsoStr: string): string {
  const today = parseIsoDateUTC(todayIsoStr)
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()
  const daysInThisMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const thisMonthDue = new Date(Date.UTC(y, m, Math.min(dueDay, daysInThisMonth)))
  if (thisMonthDue.getTime() >= today.getTime()) return thisMonthDue.toISOString().slice(0, 10)
  const daysInNextMonth = new Date(Date.UTC(y, m + 2, 0)).getUTCDate()
  return new Date(Date.UTC(y, m + 1, Math.min(dueDay, daysInNextMonth))).toISOString().slice(0, 10)
}

/** The ONE place `RecurringBill.paymentMethod`'s optionality is resolved — deliberately
 * defaults to 'manual' (the safer assumption) rather than ever silently treating an unconfirmed
 * bill as auto-paid. Used everywhere the distinction is shown, so it can't drift. */
export function resolvePaymentMethod(bill: RecurringBill): 'direct-debit' | 'manual' {
  return bill.paymentMethod ?? 'manual'
}

/** Active monthly bills due exactly today — the single shared source of truth for the
 * Upcoming Payments nav badge (count + names in its tooltip) AND the highlight-on-click
 * behaviour in UpcomingPayments.tsx, so the two can never disagree about which bills these are. */
export function dueTodayBills(bills: RecurringBill[], todayIsoStr: string): RecurringBill[] {
  return bills.filter((b) => b.active && b.frequency === 'monthly' && nextMonthlyDueDate(b.dueDay, todayIsoStr) === todayIsoStr)
}

function daysUntilLabel(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

export interface InsightsTickerInputs {
  bills: RecurringBill[]
  periodicBills: PeriodicBill[]
  sinkingFunds: SinkingFund[]
  healthScoreHistory: { date: string; score: number }[]
  streak: StreakState
  todayIso: string
}

/** Ticker item type drives icon selection in InsightsTicker.tsx — kept structured (not a bare string) specifically so the UI can vary the icon per insight, not one generic dot for everything. `severity` is only set for 'bill' items, reusing the same shared traffic-light scale as every other due-date element. */
export interface TickerItem {
  type: 'bill' | 'health' | 'streak' | 'price' | 'default'
  text: string
  severity?: DueSeverity
}

export function buildInsightsTicker(inputs: InsightsTickerInputs): TickerItem[] {
  const { bills, periodicBills, sinkingFunds, healthScoreHistory, streak, todayIso: today } = inputs
  const items: TickerItem[] = []

  // Nearest 3 upcoming due items across bills / periodic pending bills / sinking funds.
  const upcoming: { name: string; date: string }[] = []
  for (const b of bills) {
    if (!b.active || b.frequency !== 'monthly') continue
    upcoming.push({ name: b.name, date: nextMonthlyDueDate(b.dueDay, today) })
  }
  for (const pb of periodicBills) {
    if (pb.pendingBill) upcoming.push({ name: pb.name, date: pb.pendingBill.dueDate })
  }
  for (const f of sinkingFunds) {
    upcoming.push({ name: f.name, date: f.targetDate })
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date))
  for (const u of upcoming.slice(0, 3)) {
    const days = daysBetweenIso(today, u.date)
    if (days >= 0) items.push({ type: 'bill', text: `${u.name} due ${daysUntilLabel(days)}`, severity: dueDateSeverity(days) })
  }

  // Real health-score trend, only if there's genuinely a prior day to compare against.
  if (healthScoreHistory.length >= 2) {
    const sorted = [...healthScoreHistory].sort((a, b) => a.date.localeCompare(b.date))
    const latest = sorted[sorted.length - 1]
    const previous = sorted[sorted.length - 2]
    const delta = latest.score - previous.score
    if (delta > 0) items.push({ type: 'health', text: `Health score up ${delta} point${delta === 1 ? '' : 's'} since yesterday` })
    else if (delta < 0) items.push({ type: 'health', text: `Health score down ${Math.abs(delta)} point${Math.abs(delta) === 1 ? '' : 's'} since yesterday` })
    else items.push({ type: 'health', text: `Health score steady at ${latest.score}/100` })
  }

  // Streak.
  if (streak.current > 0) {
    items.push({ type: 'streak', text: `${streak.current}-day streak — staying on pace` })
  }

  // Real price-increase flags.
  for (const b of bills) {
    if (isBillAmountChanged(b)) {
      items.push({ type: 'price', text: `${b.name} changed from $${b.previousAmount!.toFixed(2)} to $${b.amount.toFixed(2)}` })
    }
  }

  return items.length > 0 ? items : [{ type: 'default', text: 'All bills on track — nothing urgent right now' }]
}

// ---------------------------------------------------------------------------
// Plain-language Dashboard headline — the literal answer in words, computed
// from real data, before any chart or number.
// ---------------------------------------------------------------------------

const HEALTH_BREAKDOWN_LABEL: Record<string, string> = {
  savingsRate: 'your savings rate',
  debtToIncome: 'debt relative to income',
  billCoverage: 'bill coverage',
  emergencyFund: 'your emergency fund',
}

export function buildDashboardHeadline(leftover: number, score: number, breakdown: HealthScoreResult['breakdown']): string {
  const weakest = Object.entries(breakdown).sort((a, b) => a[1] - b[1])[0]
  const weakestLabel = HEALTH_BREAKDOWN_LABEL[weakest[0]] ?? 'your finances'

  if (leftover < 0) {
    return `You're behind — fixed bills exceed net income by $${Math.abs(round2(leftover)).toFixed(2)} this month. ${weakestLabel[0].toUpperCase()}${weakestLabel.slice(1)} needs the most attention.`
  }
  return `You're $${round2(leftover).toFixed(2)} ahead after fixed bills this month (health score ${score}/100) — ${weakestLabel} is your biggest opportunity.`
}
