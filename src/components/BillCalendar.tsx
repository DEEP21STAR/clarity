import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { formatCurrency, formatMonthYear, todayIso } from '@/lib/utils'
import { daysBetweenIso, dueDateSeverity, isBillInstancePaid, type DueSeverity } from '@/lib/logic'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { BillIcon } from './BillIcons'
import { useToast } from './Toast'

const CALENDAR_ENTRY_TEXT: Record<DueSeverity, string> = {
  ok: 'text-cyan-300',
  warn: 'text-amber-300',
  danger: 'text-rose-300',
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface DayEntry { billId: string | null; targetType: 'recurringBill' | 'periodicBill' | null; name: string; amount: number; dateIso: string }

/** Month-grid view of every bill's due date at a glance — monthly RecurringBills by dueDay, Periodic Bills' pending lump sum, and Sinking Funds' target dates. */
export function BillCalendar() {
  const { state, recordPayment, deletePaymentRecord } = useStore()
  const { showToast } = useToast()
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() } })
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('right')

  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor])

  const today = todayIso()

  const entriesByDay = useMemo(() => {
    const map = new Map<number, DayEntry[]>()
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
    const isoOf = (day: number) => `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    for (const bill of state.bills) {
      if (!bill.active || bill.frequency !== 'monthly') continue
      const day = Math.min(bill.dueDay, daysInMonth)
      map.set(day, [...(map.get(day) ?? []), { billId: bill.id, targetType: 'recurringBill', name: bill.name, amount: bill.amount, dateIso: isoOf(day) }])
    }
    for (const pb of state.periodicBills) {
      if (!pb.pendingBill) continue
      const d = new Date(pb.pendingBill.dueDate)
      if (d.getFullYear() === cursor.year && d.getMonth() === cursor.month) {
        map.set(d.getDate(), [...(map.get(d.getDate()) ?? []), { billId: pb.id, targetType: 'periodicBill', name: pb.name, amount: pb.pendingBill.amount, dateIso: pb.pendingBill.dueDate }])
      }
    }
    for (const fund of state.sinkingFunds) {
      const d = new Date(fund.targetDate)
      if (d.getFullYear() === cursor.year && d.getMonth() === cursor.month) {
        map.set(d.getDate(), [...(map.get(d.getDate()) ?? []), { billId: null, targetType: null, name: fund.name, amount: fund.targetAmount, dateIso: fund.targetDate }])
      }
    }
    return map
  }, [state.bills, state.periodicBills, state.sinkingFunds, cursor])

  // #12 — real heat-map: background intensity scaled to the actual $ total due that
  // day, relative to the busiest day in the currently-viewed month (not a fixed scale,
  // so the heat-map stays meaningful whether Deep's bills total $500 or $5000 that month).
  const totalByDay = useMemo(() => {
    const totals = new Map<number, number>()
    for (const [day, entries] of entriesByDay) totals.set(day, entries.reduce((s, e) => s + e.amount, 0))
    return totals
  }, [entriesByDay])
  const maxDayTotal = useMemo(() => Math.max(1, ...Array.from(totalByDay.values())), [totalByDay])

  const monthLabel = formatMonthYear(cursor.year, cursor.month)

  const goMonth = (delta: number) => {
    setSlideDir(delta > 0 ? 'right' : 'left')
    setCursor((c) => shiftMonth(c, delta))
  }

  const togglePaid = (entry: DayEntry) => {
    if (!entry.billId || !entry.targetType) return
    const existing = state.paymentRecords.find((r) => r.targetId === entry.billId && r.dueDateIso === entry.dateIso)
    if (existing) {
      deletePaymentRecord(existing.id)
      showToast(`${entry.name} marked unpaid`, { tone: 'info' })
    } else {
      const id = recordPayment({
        targetType: entry.targetType, targetId: entry.billId, targetLabel: entry.name,
        amount: entry.amount, date: todayIso(), dueDateIso: entry.dateIso,
      })
      showToast(`${entry.name} marked paid — $${entry.amount.toFixed(2)} recorded`, {
        tone: 'success',
        actionLabel: 'Undo',
        onAction: () => deletePaymentRecord(id),
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="gradient-heading text-2xl font-bold tracking-tight">Bill Calendar</h2>
        <p className="text-sm text-white/50 mt-1">Every bill's due date at a glance — click a bill to mark it paid.</p>
      </div>

      {/* tilt off: a grid of precisely-clickable day cells — kept from the app-wide mouse-tilt audit. */}
      <StatCard label={monthLabel} glow="purple" tilt={false} tooltip="Background shading is a real heat-map: darker = more $ due that day, relative to this month's busiest day.">
        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => goMonth(-1)} className="text-white/40 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-sm text-white/60">{monthLabel}</span>
          <button onClick={() => goMonth(1)} className="text-white/40 hover:text-white"><ChevronRight className="w-5 h-5" /></button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] text-white/40 uppercase">
          {WEEKDAYS.map((d) => <div key={d}>{d}</div>)}
        </div>
        {/* #13 — real slide transition: keying on the viewed month forces a fresh mount every
            navigation, which re-triggers the CSS keyframe (a class toggle alone wouldn't
            re-fire on the same element). */}
        <div key={`${cursor.year}-${cursor.month}`} className={`mt-1 grid grid-cols-7 gap-1 ${slideDir === 'right' ? 'calendar-slide-right' : 'calendar-slide-left'}`}>
          {grid.map((day, i) => {
            const dayTotal = day ? totalByDay.get(day) ?? 0 : 0
            const heat = dayTotal > 0 ? 0.08 + (dayTotal / maxDayTotal) * 0.32 : 0
            return (
              <div
                key={i}
                className={`min-h-[64px] rounded-lg border p-1 text-left ${day ? 'border-white/10' : 'border-transparent'}`}
                style={day ? { backgroundColor: `rgba(168,85,247,${heat})` } : undefined}
              >
                {day && (
                  <>
                    <div className="flex items-center justify-between text-[10px] text-white/40">
                      <span>{day}</span>
                      {dayTotal > 0 && <span className="text-white/30">{formatCurrency(dayTotal)}</span>}
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {(entriesByDay.get(day) ?? []).slice(0, 3).map((e, j) => {
                        const daysUntil = daysBetweenIso(today, e.dateIso)
                        const paid = e.billId ? isBillInstancePaid(state.paymentRecords, e.billId, e.dateIso) : false
                        // #8 upgrade over Round 19's guess: a PAID instance is genuinely done
                        // regardless of date; only an UNPAID past instance is genuinely overdue now.
                        const severity = paid ? null : daysUntil >= 0 ? dueDateSeverity(daysUntil) : 'danger'
                        const textClass = paid ? 'text-emerald-400/70 line-through' : severity ? CALENDAR_ENTRY_TEXT[severity] : 'text-white/35'
                        const tooltip = paid ? 'paid'
                          : severity === 'danger' ? 'overdue — unpaid past due date'
                          : severity === 'warn' ? 'due soon'
                          : 'not due soon'
                        return (
                          <button
                            key={j}
                            type="button"
                            onClick={() => togglePaid(e)}
                            disabled={!e.billId}
                            title={`${e.name}: ${formatCurrency(e.amount)} — ${tooltip}${e.billId ? ' (click to toggle paid)' : ''}`}
                            className={`w-full flex items-center gap-1 text-[9px] truncate ${textClass} ${e.billId ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                          >
                            {paid ? (
                              <svg className="checkmark-draw w-2.5 h-2.5 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none">
                                <path d="M4 12l6 6L20 6" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : (
                              <BillIcon name={e.name} className="w-2.5 h-2.5 shrink-0" />
                            )}
                            <span className="truncate">{e.name}</span>
                            {!paid && severity && severity !== 'ok' && <span className={`w-1 h-1 rounded-full shrink-0 ${severity === 'danger' ? 'bg-rose-400' : 'bg-amber-400'} animate-pulse`} />}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-[10px] text-white/30 flex items-center gap-1"><Check className="w-2.5 h-2.5" /> Click any bill (not sinking funds) to mark it paid/unpaid for that specific due date.</p>
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
