// Real browser Notification API integration for bill-due alerts. Honest scope: this fires
// while the tab/PWA is open (or freshly reloaded) — there is no push server, so it CANNOT
// wake a closed browser or notify on a phone with the app fully killed. Deep must be told
// this limitation explicitly rather than sold "even when closed" push.
import type { RecurringBill, PeriodicBill } from './types'
import { nextMonthlyDueDate, daysBetweenIso } from './logic'

const SENT_LOG_KEY = 'clarity-bill-alerts-sent-v1'

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied'
  return Notification.requestPermission()
}

export interface DueAlertItem {
  key: string
  name: string
  amount: number
  daysUntil: number
}

/** Bills/periodic pending charges due today or tomorrow — the real alert window. */
export function billsDueForAlert(bills: RecurringBill[], periodicBills: PeriodicBill[], todayIsoStr: string): DueAlertItem[] {
  const items: DueAlertItem[] = []
  for (const b of bills) {
    if (!b.active || b.frequency !== 'monthly') continue
    const due = nextMonthlyDueDate(b.dueDay, todayIsoStr)
    const days = daysBetweenIso(todayIsoStr, due)
    if (days === 0 || days === 1) items.push({ key: `bill-${b.id}-${due}`, name: b.name, amount: b.amount, daysUntil: days })
  }
  for (const pb of periodicBills) {
    if (!pb.pendingBill) continue
    const days = daysBetweenIso(todayIsoStr, pb.pendingBill.dueDate)
    if (days === 0 || days === 1) items.push({ key: `periodic-${pb.id}-${pb.pendingBill.dueDate}`, name: pb.name, amount: pb.pendingBill.amount, daysUntil: days })
  }
  return items
}

function readSentLog(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(SENT_LOG_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeSentLog(log: Record<string, true>) {
  try {
    localStorage.setItem(SENT_LOG_KEY, JSON.stringify(log))
  } catch {
    /* ignore */
  }
}

/** Fires a real Notification for each due item not already sent (deduped by key, persisted
 * across reloads so opening the app twice in one day doesn't double-notify). Returns how many
 * were actually sent. */
export function sendDueBillNotifications(items: DueAlertItem[]): number {
  if (getNotificationPermission() !== 'granted') return 0
  const log = readSentLog()
  let sent = 0
  for (const item of items) {
    if (log[item.key]) continue
    const when = item.daysUntil === 0 ? 'due today' : 'due tomorrow'
    new Notification(`${item.name} ${when}`, {
      body: `$${item.amount.toFixed(2)} — Clarity`,
      tag: item.key,
      icon: '/clarity/pwa-192x192.png',
    })
    log[item.key] = true
    sent++
  }
  if (sent > 0) writeSentLog(log)
  return sent
}
