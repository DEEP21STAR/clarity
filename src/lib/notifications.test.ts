import { describe, it, expect, beforeEach } from 'vitest'
import { billsDueForAlert, sendDueBillNotifications, getNotificationPermission, isNotificationSupported } from './notifications'
import type { RecurringBill, PeriodicBill } from './types'

function bill(overrides: Partial<RecurringBill> & { id: string; name: string; amount: number; dueDay: number }): RecurringBill {
  return { frequency: 'monthly', dueDayIsEstimate: false, category: 'other', active: true, owner: 'shared', ...overrides }
}

describe('billsDueForAlert', () => {
  it('includes a monthly bill due exactly today', () => {
    const items = billsDueForAlert([bill({ id: 'b1', name: 'Power', amount: 120, dueDay: 15 })], [], '2026-09-15')
    expect(items).toEqual([{ key: 'bill-b1-2026-09-15', name: 'Power', amount: 120, daysUntil: 0 }])
  })

  it('includes a monthly bill due tomorrow but excludes one due in 2+ days', () => {
    const items = billsDueForAlert(
      [bill({ id: 'b1', name: 'Power', amount: 120, dueDay: 16 }), bill({ id: 'b2', name: 'Rent', amount: 400, dueDay: 20 })],
      [],
      '2026-09-15'
    )
    expect(items.map((i) => i.name)).toEqual(['Power'])
  })

  it('excludes inactive bills and non-monthly frequencies', () => {
    const items = billsDueForAlert(
      [bill({ id: 'b1', name: 'Power', amount: 120, dueDay: 15, active: false }), bill({ id: 'b2', name: 'Weekly thing', amount: 10, dueDay: 15, frequency: 'weekly' })],
      [],
      '2026-09-15'
    )
    expect(items).toEqual([])
  })

  it('includes a periodic bill pending charge due today', () => {
    const pb: PeriodicBill = {
      id: 'p1', name: 'Power (usage)', pendingBill: { amount: 88, dueDate: '2026-09-15', periodStart: '2026-08-15', periodEnd: '2026-09-14' },
      gaugePeriodStart: '2026-09-15', gaugePeriodEnd: '2026-10-14', projectedCharge: 90, inCredit: false, creditAmount: 0,
      smoothingEnabled: false, owner: 'shared',
    }
    const items = billsDueForAlert([], [pb], '2026-09-15')
    expect(items).toEqual([{ key: 'periodic-p1-2026-09-15', name: 'Power (usage)', amount: 88, daysUntil: 0 }])
  })
})

describe('sendDueBillNotifications', () => {
  const originalNotification = (globalThis as any).Notification

  beforeEach(() => {
    localStorage.clear()
  })

  it('does nothing when permission is not granted', () => {
    ;(globalThis as any).Notification = { permission: 'default' }
    const sent = sendDueBillNotifications([{ key: 'k1', name: 'Power', amount: 10, daysUntil: 0 }])
    expect(sent).toBe(0)
    ;(globalThis as any).Notification = originalNotification
  })

  it('fires a real Notification for each unseen item and dedupes on a second call', () => {
    const fired: string[] = []
    class FakeNotification {
      static permission = 'granted'
      constructor(title: string) { fired.push(title) }
    }
    ;(globalThis as any).Notification = FakeNotification

    const items = [{ key: 'k1', name: 'Power', amount: 120, daysUntil: 0 }, { key: 'k2', name: 'Rent', amount: 400, daysUntil: 1 }]
    const first = sendDueBillNotifications(items)
    expect(first).toBe(2)
    expect(fired).toEqual(['Power due today', 'Rent due tomorrow'])

    const second = sendDueBillNotifications(items)
    expect(second).toBe(0) // already sent — dedupe log persisted in localStorage

    ;(globalThis as any).Notification = originalNotification
  })
})

describe('permission helpers', () => {
  it('reports unsupported when Notification is not on window', () => {
    const hadNotification = 'Notification' in globalThis
    const originalNotification = (globalThis as any).Notification
    delete (globalThis as any).Notification
    expect(isNotificationSupported()).toBe(false)
    expect(getNotificationPermission()).toBe('unsupported')
    if (hadNotification) (globalThis as any).Notification = originalNotification
  })
})
