import type { RecurringBill, Transaction } from './types'

/**
 * Old or hand-edited saved data can hold transactions with a missing category, a text amount, a numeric date or even a null list.
 * One such row used to crash a whole screen. This keeps EVERY row (nothing is deleted, because the cleaned list is saved back) and only
 * coerces malformed fields into the shape the app expects. A row that is already well-formed is returned unchanged.
 */
export function sanitizeTransactions(raw: unknown): Transaction[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((t) => t !== null && typeof t === 'object').map((t, i) => {
    const o = t as Record<string, unknown>
    const amountNum = typeof o.amount === 'number' ? o.amount : parseFloat(String(o.amount ?? ''))
    const wellFormed =
      typeof o.id === 'string' && typeof o.date === 'string' && typeof o.description === 'string' &&
      typeof o.amount === 'number' && Number.isFinite(o.amount) && typeof o.category === 'string' && o.category !== '' &&
      (o.mode === 'personal' || o.mode === 'business')
    if (wellFormed) return t as Transaction
    return {
      ...o,
      id: typeof o.id === 'string' && o.id !== '' ? o.id : `tx-recovered-${i}`,
      date: typeof o.date === 'string' ? o.date : o.date == null ? '' : String(o.date),
      description: typeof o.description === 'string' ? o.description : o.description == null ? '' : String(o.description),
      amount: Number.isFinite(amountNum) ? amountNum : 0,
      category: typeof o.category === 'string' && o.category !== '' ? o.category : 'uncategorised',
      mode: o.mode === 'business' ? 'business' : 'personal',
    } as Transaction
  })
}

/** The saved lists whose rows are objects. One null or number in any of them used to crash every screen that reads the list. */
export const OBJECT_LIST_FIELDS = [
  'bills', 'accounts', 'debts', 'creditCards', 'deviceRepayments', 'periodicBills', 'netWorthHistory',
  'savingsGoals', 'oneOffEntries', 'sinkingFunds', 'healthScoreHistory', 'paymentRecords',
] as const

/**
 * Drops anything that is not an object from each saved list, and replaces a list that is not a list at all with the fallback's.
 * Well-formed rows are returned as they are (the same objects), so nothing else changes.
 */
export function dropNonObjectRows<T extends object>(state: T, fallback: object): T {
  const out = { ...state } as Record<string, unknown>
  const fb = fallback as Record<string, unknown>
  for (const f of OBJECT_LIST_FIELDS) {
    const v = out[f]
    if (v === undefined) continue
    if (!Array.isArray(v)) { out[f] = fb[f]; continue }
    if (v.some((r) => r === null || typeof r !== 'object')) out[f] = v.filter((r) => r !== null && typeof r === 'object')
  }
  return out as T
}

const BILL_FREQUENCIES = ['weekly', 'fortnightly', 'monthly'] as const
const BILL_CATEGORIES = ['housing', 'utilities', 'insurance', 'subscription', 'debt', 'other'] as const

/**
 * Saved bills with a missing or wrong-typed field (no due day, a text amount, an unknown frequency) used to crash screens that do date
 * maths on them. Every bill is kept; only broken fields are coerced into the shape the app expects. A well-formed bill is returned as is.
 */
export function sanitizeBills(raw: unknown): RecurringBill[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((b) => b !== null && typeof b === 'object').map((b, i) => {
    const o = b as Record<string, unknown>
    const amount = typeof o.amount === 'number' ? o.amount : parseFloat(String(o.amount ?? ''))
    const dueDay = typeof o.dueDay === 'number' ? o.dueDay : parseInt(String(o.dueDay ?? ''), 10)
    const okFreq = (BILL_FREQUENCIES as readonly unknown[]).includes(o.frequency)
    const okCat = (BILL_CATEGORIES as readonly unknown[]).includes(o.category)
    const wellFormed = typeof o.id === 'string' && typeof o.name === 'string' && typeof o.amount === 'number' && Number.isFinite(o.amount) &&
      okFreq && typeof o.dueDay === 'number' && Number.isInteger(o.dueDay) && o.dueDay >= 1 && o.dueDay <= 31 && typeof o.dueDayIsEstimate === 'boolean' &&
      okCat && typeof o.active === 'boolean'
    if (wellFormed) return b as RecurringBill
    return {
      ...o,
      id: typeof o.id === 'string' && o.id !== '' ? o.id : `bill-recovered-${i}`,
      name: typeof o.name === 'string' ? o.name : o.name == null ? 'Bill' : String(o.name),
      amount: Number.isFinite(amount) ? amount : 0,
      frequency: okFreq ? o.frequency : 'monthly',
      dueDay: Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31 ? dueDay : 1,
      dueDayIsEstimate: typeof o.dueDayIsEstimate === 'boolean' ? o.dueDayIsEstimate : true,
      category: okCat ? o.category : 'other',
      active: typeof o.active === 'boolean' ? o.active : true,
    } as RecurringBill
  })
}

type Kind = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object'
const ISO_DAY = /^\d{4}-\d{2}-\d{2}/
const isDay = (v: unknown): v is string => typeof v === 'string' && ISO_DAY.test(v) && !Number.isNaN(Date.parse(v.slice(0, 10)))
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const isKind = (v: unknown, k: Kind): boolean =>
  k === 'string' ? typeof v === 'string' : k === 'number' ? typeof v === 'number' && Number.isFinite(v) : k === 'boolean' ? typeof v === 'boolean'
    : k === 'date' ? isDay(v) : k === 'array' ? Array.isArray(v) : v !== null && typeof v === 'object' && !Array.isArray(v)
function fix(v: unknown, k: Kind, fallbackObj?: unknown): unknown {
  if (isKind(v, k)) return v
  if (k === 'number') { const n = parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : 0 }
  if (k === 'string') return v == null ? '' : String(v)
  if (k === 'boolean') return v === true || v === 'true'
  if (k === 'date') return todayStr()
  if (k === 'array') return []
  return fallbackObj ?? {}
}

/** The fields each saved list's rows must have for the screens that read them. Every other field of a row is left alone. */
export const ROW_SPECS: Record<string, Record<string, Kind>> = {
  accounts: { id: 'string', name: 'string', value: 'number', countsTowardLiveFunds: 'boolean' },
  creditCards: { id: 'string', name: 'string', balance: 'number', availableToSpend: 'number', minPayment: 'number', plans: 'array', rates: 'object' },
  debts: { id: 'string', name: 'string', balance: 'number', apr: 'number', minPayment: 'number' },
  deviceRepayments: { id: 'string', name: 'string', monthlyAmount: 'number', remaining: 'number', paymentsTotal: 'number', paymentsRemaining: 'number' },
  sinkingFunds: { id: 'string', name: 'string', targetAmount: 'number', targetDate: 'date', currentSaved: 'number' },
  savingsGoals: { id: 'string', name: 'string', targetAmount: 'number', contributedAmount: 'number', fundedThisPeriod: 'number' },
  periodicBills: { id: 'string', name: 'string', gaugePeriodStart: 'date', gaugePeriodEnd: 'date', projectedCharge: 'number', inCredit: 'boolean', creditAmount: 'number', smoothingEnabled: 'boolean' },
  oneOffEntries: { id: 'string', date: 'date', description: 'string', amount: 'number' },
  netWorthHistory: { date: 'date', netWorth: 'number', totalAssets: 'number', totalLiabilities: 'number' },
  healthScoreHistory: { date: 'date', score: 'number' },
  paymentRecords: { id: 'string', targetId: 'string', targetLabel: 'string', amount: 'number', date: 'date', recordedAt: 'string' },
}

/**
 * Keeps every row of a saved list and repairs only the fields the screens depend on (text amount -> number, missing or unreadable date ->
 * today, missing list -> empty list). A row that is already right is returned as the same object. `objectFallbacks` supplies the value for
 * a missing object field such as a card's rates.
 */
export function sanitizeRows<T>(raw: unknown, list: string, objectFallbacks: Record<string, unknown> = {}): T[] {
  if (!Array.isArray(raw)) return []
  const spec = ROW_SPECS[list]
  return raw.filter((r) => r !== null && typeof r === 'object' && !Array.isArray(r)).map((r) => {
    const o = r as Record<string, unknown>
    let out: Record<string, unknown> | null = null
    for (const [f, k] of Object.entries(spec ?? {})) {
      if (isKind(o[f], k)) continue
      out ??= { ...o }
      out[f] = fix(o[f], k, objectFallbacks[f])
    }
    // a periodic bill's pending bill is optional, but when present its fields are read as numbers and dates
    if (list === 'periodicBills' && o.pendingBill !== undefined) {
      const pb = o.pendingBill as Record<string, unknown> | null
      const ok = pb !== null && typeof pb === 'object' && typeof pb.amount === 'number' && Number.isFinite(pb.amount) && isDay(pb.dueDate) && isDay(pb.periodStart) && isDay(pb.periodEnd)
      if (!ok) { out ??= { ...o }; delete out.pendingBill }
    }
    if (list === 'paymentRecords' && !['recurringBill', 'creditCard', 'installmentPlan', 'periodicBill', 'deviceRepayment'].includes(o.targetType as string)) { out ??= { ...o }; out.targetType = 'recurringBill' }
    return (out ?? o) as T
  })
}

/** The single-object and small-list settings the screens read directly. Anything unreadable falls back to the default. */
export function sanitizeSettings<T extends object>(state: T, fallback: object): T {
  const out = { ...state } as Record<string, unknown>
  const fb = fallback as Record<string, Record<string, unknown>>
  const num = (v: unknown, d: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : (typeof d === 'number' ? d : 0))
  const day = (v: unknown, d: unknown) => (isDay(v) ? v : (typeof d === 'string' ? d : todayStr()))
  const st = out.spendTracker as Record<string, unknown> | null | undefined
  if (st === null || typeof st !== 'object' || Array.isArray(st)) out.spendTracker = fb.spendTracker
  else if (!(['food', 'fuel', 'personal'].every((k) => typeof st[k] === 'number' && Number.isFinite(st[k])) && isDay(st.periodStart)))
    out.spendTracker = { ...st, food: num(st.food, 0), fuel: num(st.fuel, 0), personal: num(st.personal, 0), periodStart: day(st.periodStart, fb.spendTracker?.periodStart) }
  const ia = out.incomeAnchor as Record<string, unknown> | null | undefined
  if (ia === null || typeof ia !== 'object' || Array.isArray(ia)) out.incomeAnchor = fb.incomeAnchor
  else if (!(isDay(ia.anchorDate) && typeof ia.weeklyAmount === 'number' && typeof ia.fortnightlyBonusAmount === 'number'))
    out.incomeAnchor = { ...ia, anchorDate: day(ia.anchorDate, fb.incomeAnchor?.anchorDate), weeklyAmount: num(ia.weeklyAmount, fb.incomeAnchor?.weeklyAmount), fortnightlyBonusAmount: num(ia.fortnightlyBonusAmount, fb.incomeAnchor?.fortnightlyBonusAmount) }
  const order = out.dashboardCardOrder
  if (!Array.isArray(order)) out.dashboardCardOrder = (fallback as Record<string, unknown>).dashboardCardOrder
  else if (order.some((x) => typeof x !== 'string')) out.dashboardCardOrder = order.filter((x) => typeof x === 'string')
  return out as T
}
