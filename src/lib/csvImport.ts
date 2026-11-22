import type { Mode, Transaction } from './types'
import { guessCol, guessTransactionCategory, parseCsvAmount, parseCsvText } from './logic'

/**
 * Safer bank-CSV import, built on the existing column detection in logic.ts. Adds what a plain
 * "map and add" import lacked: dates normalised to YYYY-MM-DD (day-first unless the file proves
 * otherwise, the NZ/AU convention), rows with no usable date or amount reported instead of
 * silently imported, and statement re-imports recognised so the same file can never double the
 * ledger. Pure functions only: the UI shows the preview and the user confirms before anything is added.
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = (n: number) => String(n).padStart(2, '0')
const validYmd = (y: number, m: number, d: number) => {
  if (m < 1 || m > 12 || d < 1 || y < 1990 || y > 2100) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** A date string from a bank file as YYYY-MM-DD, or null. `dayFirst` picks the reading of an ambiguous 05/06/2026. */
export function normaliseDate(raw: string, dayFirst = true): string | null {
  const s = (raw ?? '').trim().replace(/\s+/g, ' ')
  if (!s) return null
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/.exec(s)
  if (m) return validYmd(+m[1], +m[2], +m[3]) ? `${m[1]}-${pad(+m[2])}-${pad(+m[3])}` : null
  m = /^(\d{1,2})[-/. ]([A-Za-z]{3,9})[-/. ,]+(\d{2,4})$/.exec(s)
  if (m) {
    const mon = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1
    let y = +m[3]; if (y < 100) y += 2000
    return mon > 0 && validYmd(y, mon, +m[1]) ? `${y}-${pad(mon)}-${pad(+m[1])}` : null
  }
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ T].*)?$/.exec(s)
  if (m) {
    let a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000
    let day = dayFirst ? a : b, mon = dayFirst ? b : a
    if (mon > 12 && day <= 12) [day, mon] = [mon, day] // only one reading is a real month
    return validYmd(y, mon, day) ? `${y}-${pad(mon)}-${pad(day)}` : null
  }
  return null
}

/** True when the dates in these cells can only be read month-first (a middle part above 12 and a first part never above 12). */
function fileIsMonthFirst(cells: string[]): boolean {
  let firstOver12 = false, secondOver12 = false
  for (const c of cells) {
    const m = /^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/.exec(c.trim())
    if (!m) continue
    if (+m[1] > 12) firstOver12 = true
    if (+m[2] > 12) secondOver12 = true
  }
  return secondOver12 && !firstOver12
}

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
/** Identity of a transaction for duplicate checks: day + exact cents + tidied description. */
export const txKey = (t: Pick<Transaction, 'date' | 'amount' | 'description'>) => `${t.date}|${Math.round(t.amount * 100)}|${norm(t.description)}`

export interface SkippedRow { line: number; reason: string; text: string }
export interface CsvPreview {
  /** New transactions ready to add. */
  fresh: Transaction[]
  /** Rows already in the ledger (same day, amount and description): will not be added again. */
  duplicates: Transaction[]
  skipped: SkippedRow[]
  columns: { date: string; description: string; amount: string }
  income: number
  spend: number
  firstDate: string | null
  lastDate: string | null
}

export function previewCsvImport(text: string, mode: Mode, existing: readonly Transaction[] = []): CsvPreview {
  const { header, rows } = parseCsvText(text)
  const guess = guessCol(header, rows.slice(0, Math.min(20, rows.length)))
  const dayFirst = !fileIsMonthFirst(rows.map((r) => r[guess.dateCol] ?? ''))
  const have = new Map<string, number>()
  for (const t of existing) have.set(txKey(t), (have.get(txKey(t)) ?? 0) + 1)

  const fresh: Transaction[] = [], duplicates: Transaction[] = [], skipped: SkippedRow[] = []
  const seenInFile = new Map<string, number>()
  rows.forEach((row, i) => {
    const line = i + 2 // header is line 1
    const date = normaliseDate(row[guess.dateCol] ?? '', dayFirst)
    if (!date) { skipped.push({ line, reason: 'no readable date', text: row.join(', ').slice(0, 80) }); return }
    let amount = 0, hasAmount = false
    if (guess.debitCol !== undefined || guess.creditCol !== undefined) {
      const d = guess.debitCol !== undefined ? (row[guess.debitCol] ?? '').trim() : ''
      const c = guess.creditCol !== undefined ? (row[guess.creditCol] ?? '').trim() : ''
      hasAmount = d !== '' || c !== ''
      amount = (c ? parseCsvAmount(c) : 0) - (d ? Math.abs(parseCsvAmount(d)) : 0)
    } else if (guess.amountCol !== -1) {
      const a = (row[guess.amountCol] ?? '').trim()
      hasAmount = a !== ''
      amount = parseCsvAmount(a)
    }
    if (!hasAmount || !Number.isFinite(amount) || amount === 0) { skipped.push({ line, reason: 'no amount', text: row.join(', ').slice(0, 80) }); return }
    amount = Math.round(amount * 100) / 100
    const description = (row[guess.descriptionCol] ?? '').trim() || '(no description)'
    const base = { date, amount, description }
    const key = txKey(base)
    const nth = (seenInFile.get(key) ?? 0) + 1
    seenInFile.set(key, nth)
    const tx: Transaction = { id: `csv-${key.replace(/[^A-Za-z0-9|-]/g, '')}-${nth}`, ...base, category: guessTransactionCategory(description), mode }
    const left = have.get(key) ?? 0
    if (left > 0) { have.set(key, left - 1); duplicates.push(tx) } else fresh.push(tx)
  })

  const dates = fresh.map((t) => t.date).sort()
  return {
    fresh, duplicates, skipped,
    columns: { date: header[guess.dateCol] ?? '?', description: header[guess.descriptionCol] ?? '?', amount: guess.debitCol !== undefined || guess.creditCol !== undefined ? `${header[guess.debitCol ?? -1] ?? '?'} / ${header[guess.creditCol ?? -1] ?? '?'}` : (header[guess.amountCol] ?? '?') },
    income: Math.round(fresh.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0) * 100) / 100,
    spend: Math.round(fresh.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0) * 100) / 100,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
  }
}
