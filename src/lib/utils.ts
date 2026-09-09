import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(n: number, currency: 'NZD' | 'AUD' = 'NZD'): string {
  const symbol = currency === 'NZD' ? '$' : 'A$'
  const sign = n < 0 ? '-' : ''
  return `${sign}${symbol}${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Today's date as YYYY-MM-DD in the VIEWER'S LOCAL calendar day — not UTC.
 * `toISOString()` converts to UTC first, which silently shifts the date
 * backward for any UTC+ timezone (e.g. NZ, UTC+12/13) whenever local time
 * is past midnight but the UTC day hasn't rolled over yet. That mismatch
 * was caught live: the Month-view income figure was off by a day's worth
 * of Fridays because of it.
 */
export function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
