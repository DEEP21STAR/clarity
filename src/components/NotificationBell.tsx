import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { buildInsightsTicker } from '@/lib/logic'
import { todayIso } from '@/lib/utils'
import { Bell, CalendarClock, AlertTriangle } from 'lucide-react'

/**
 * #29 — notification bell with an unread-count badge and a dropdown of
 * recent alerts. Deliberately REUSES buildInsightsTicker() rather than a
 * second parallel "what needs attention" implementation — a bell-worthy
 * alert is exactly a ticker item that's either a real price change or a
 * bill/plan due date that's already inside the warn/danger traffic-light
 * window (see dueDateSeverity in logic.ts), so filtering the same real data
 * keeps this in sync with the ticker and the calendar by construction.
 */
export function NotificationBell() {
  const { state } = useStore()
  const [open, setOpen] = useState(false)
  const [rung, setRung] = useState(false)
  const prevCount = useRef<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const alerts = useMemo(() => {
    const items = buildInsightsTicker({
      bills: state.bills,
      periodicBills: state.periodicBills,
      sinkingFunds: state.sinkingFunds,
      healthScoreHistory: state.healthScoreHistory,
      streak: state.streak,
      todayIso: todayIso(),
    })
    return items.filter((i) => i.type === 'price' || (i.type === 'bill' && i.severity && i.severity !== 'ok'))
  }, [state.bills, state.periodicBills, state.sinkingFunds, state.healthScoreHistory, state.streak])

  useEffect(() => {
    if (prevCount.current !== null && alerts.length > prevCount.current) {
      setRung(true)
      const t = setTimeout(() => setRung(false), 650)
      return () => clearTimeout(t)
    }
    prevCount.current = alerts.length
  }, [alerts.length])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`${alerts.length} alert${alerts.length === 1 ? '' : 's'} — price changes and bills due soon`}
        className="relative text-white/50 hover:text-cyan-300 transition-colors p-1.5"
      >
        <Bell className={`w-4 h-4 ${rung ? 'bell-ring' : ''}`} />
        {alerts.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {alerts.length > 9 ? '9+' : alerts.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-cyan-400/30 bg-[#0b0d14] shadow-[0_0_40px_-10px_rgba(34,211,238,0.4)] overflow-hidden z-50">
          <div className="px-3 py-2 text-xs font-semibold text-white/50 uppercase tracking-wide border-b border-white/10">Recent alerts</div>
          <div className="max-h-64 overflow-y-auto">
            {alerts.length === 0 && <div className="px-3 py-4 text-sm text-white/30">Nothing needs attention right now.</div>}
            {alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2 text-sm border-t border-white/5 first:border-t-0">
                {a.type === 'price' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                ) : (
                  <CalendarClock className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${a.severity === 'danger' ? 'text-rose-400' : 'text-amber-400'}`} />
                )}
                <span className="text-white/70">{a.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
