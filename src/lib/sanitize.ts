import type { Transaction } from './types'

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
