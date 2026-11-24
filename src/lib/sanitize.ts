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
