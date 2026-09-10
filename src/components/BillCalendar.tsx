import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { formatCurrency } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BillIcon } from './BillIcons'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Month-grid view of every bill's due date at a glance — monthly RecurringBills by dueDay, Periodic Bills' pending lump sum, and Sinking Funds' target dates. */
export function BillCalendar() {
  const { state } = useStore()
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() } })

  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor])

  const entriesByDay = useMemo(() => {
    const map = new Map<number, { name: string; amount: number }[]>()
    for (const bill of state.bills) {
      if (!bill.active || bill.frequency !== 'monthly') continue
      const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
      const day = Math.min(bill.dueDay, daysInMonth)
      map.set(day, [...(map.get(day) ?? []), { name: bill.name, amount: bill.amount }])
    }
    for (const pb of state.periodicBills) {
      if (!pb.pendingBill) continue
      const d = new Date(pb.pendingBill.dueDate)
      if (d.getFullYear() === cursor.year && d.getMonth() === cursor.month) {
        map.set(d.getDate(), [...(map.get(d.getDate()) ?? []), { name: pb.name, amount: pb.pendingBill.amount }])
      }
    }
    for (const fund of state.sinkingFunds) {
      const d = new Date(fund.targetDate)
      if (d.getFullYear() === cursor.year && d.getMonth() === cursor.month) {
        map.set(d.getDate(), [...(map.get(d.getDate()) ?? []), { name: fund.name, amount: fund.targetAmount }])
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
                    {(entriesByDay.get(day) ?? []).slice(0, 3).map((e, j) => (
                      <div key={j} title={`${e.name}: ${formatCurrency(e.amount)}`} className="flex items-center gap-1 text-[9px] text-cyan-300 truncate">
                        <BillIcon name={e.name} className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{e.name}</span>
                      </div>
                    ))}
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
