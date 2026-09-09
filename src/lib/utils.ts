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

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
