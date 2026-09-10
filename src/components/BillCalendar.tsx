import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { formatCurrency, todayIso } from '@/lib/utils'
import { daysBetweenIso, dueDateSeverity, type DueSeverity } from '@/lib/logic'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BillIcon } from './BillIcons'

const CALENDAR_ENTRY_TEXT: Record<DueSeverity, string> = {
  ok: 'text-cyan-300',
  warn: 'text-amber-300',
  danger: 'text-rose-300',
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Month-grid view of every bill's due date at a glance — monthly RecurringBills by dueDay, Periodic Bills' pending lump sum, and Sinking Funds' target dates. */
export function BillCalendar() {
  const { state } = useStore()
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() } })

  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor])

  const today = todayIso()

  const entriesByDay = useMemo(() => {
    const map = new Map<number, { name: string; amount: number; dateIso: string }[]>()
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
    const isoOf = (day: number) => `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    for (const bill of state.bills) {
      if (!bill.active || bill.frequency !== 'monthly') continue
      const day = Math.min(bill.dueDay, daysInMonth)
      map.set(day, [...(map.get(day) ?? []), { name: bill.name, amount: bill.amount, dateIso: isoOf(day) }])
    }
    for (const pb of state.periodicBills) {
      if (!pb.pendingBill) continue
      const d = new Date(pb.pendingBill.dueDate)
      if (d.getFullYear() === cursor.year && d.getMonth() === cursor.month) {
        map.set(d.getDate(), [...(map.get(d.getDate()) ?? []), { name: pb.name, amount: pb.pendingBill.amount, dateIso: pb.pendingBill.dueDate }])
      }
    }
    for (const fund of state.sinkingFunds) {
      const d = new Date(fund.targetDate)
      if (d.getFullYear() === cursor.year && d.getMonth() === cursor.month) {
        map.set(d.getDate(), [...(map.get(d.getDate()) ?? []), { name: fund.name, amount: fund.targetAmount, dateIso: fund.targetDate }])
      }
    }
    return map
  }, [state.bills, state.periodicBills, state.sinkingFunds, cursor])

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="gradient-heading text-2xl font-bold tracking-tight">Bill Calendar</h2>
        <p className="text-sm text-white/50 mt-1">Every bill's due date at a glance.</p>
      </div>

      <StatCard label={monthLabel} glow="purple" tilt={false}>
        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => setCursor((c) => shiftMonth(c, -1))} className="text-white/40 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-sm text-white/60">{monthLabel}</span>
          <button onClick={() => setCursor((c) => shiftMonth(c, 1))} className="text-white/40 hover:text-white"><ChevronRight className="w-5 h-5" /></button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] text-white/40 uppercase">
          {WEEKDAYS.map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {grid.map((day, i) => (
            <div
              key={i}
              className={`min-h-[64px] rounded-lg border p-1 text-left ${day ? 'border-white/10 bg-black/20' : 'border-transparent'}`}
            >
              {day && (
                <>
                  <div className="text-[10px] text-white/40">{day}</div>
                  <div className="space-y-0.5 mt-0.5">
                    {(entriesByDay.get(day) ?? []).slice(0, 3).map((e, j) => {
                      const daysUntil = daysBetweenIso(today, e.dateIso)
                      // A calendar cell already in the past isn't "overdue" — recurring bills have
                      // no paid-tracking, so a day-of-month that's already gone by this month was
                      // very likely already paid. Only today-or-future cells get real traffic-light
                      // urgency; past cells stay neutral so the calendar doesn't cry wolf on history.
                      const severity = daysUntil >= 0 ? dueDateSeverity(daysUntil) : null
                      const textClass = severity ? CALENDAR_ENTRY_TEXT[severity] : 'text-white/35'
                      const tooltip = severity === 'danger' ? 'due very soon / overdue'
                        : severity === 'warn' ? 'due soon'
                        : severity === 'ok' ? 'not due soon'
                        : 'already passed this month'
                      return (
                        <div
                          key={j}
                          title={`${e.name}: ${formatCurrency(e.amount)} — ${tooltip}`}
                          className={`flex items-center gap-1 text-[9px] truncate ${textClass}`}
                        >
                          <BillIcon name={e.name} className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{e.name}</span>
                          {severity && severity !== 'ok' && <span className={`w-1 h-1 rounded-full shrink-0 ${severity === 'danger' ? 'bg-rose-400' : 'bg-amber-400'} animate-pulse`} />}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </StatCard>
    </div>
  )
}

function shiftMonth(c: { year: number; month: number }, delta: number) {
  const total = c.year * 12 + c.month + delta
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 }
}

function buildMonthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay() // 0 = Sunday
  const mondayOffset = (firstDay + 6) % 7 // convert to Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const grid: (number | null)[] = Array(mondayOffset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) grid.push(d)
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}
