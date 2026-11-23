import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { daysRemainingInPeriod, periodProgressPercent, suggestedFortnightlySetAside, dueDateSeverity, daysBetweenIso, type DueSeverity } from '@/lib/logic'
import { cn, formatCurrency, formatShortDate, todayIso } from '@/lib/utils'
import type { PeriodicBill } from '@/lib/types'
import { CheckCircle2, Clock, Pencil, Trash2 } from 'lucide-react'
import { DueBadge } from './DueBadge'
import { RecordPaymentButton } from './RecordPaymentForm'

const PENDING_BILL_SEVERITY_CLASSES: Record<DueSeverity, string> = {
  ok: 'border-emerald-400/30 bg-emerald-500/10',
  warn: 'border-amber-400/30 bg-amber-500/10',
  danger: 'border-rose-400/40 bg-rose-500/10',
}
const PENDING_BILL_TEXT_CLASSES: Record<DueSeverity, string> = {
  ok: 'text-emerald-300',
  warn: 'text-amber-300',
  danger: 'text-rose-300',
}

const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Projected-charges gauge for a usage-metered periodic bill (gas/power style), with fortnightly-smoothing suggestion. */
export function PeriodicBillGauge({
  bill,
  delay = 0,
  onEdit,
  onRemove,
}: {
  bill: PeriodicBill
  delay?: number
  onEdit?: () => void
  onRemove?: () => void
}) {
  const today = todayIso()
  const progress = periodProgressPercent(bill.gaugePeriodStart, bill.gaugePeriodEnd, today)
  const daysLeft = daysRemainingInPeriod(bill.gaugePeriodEnd, today)
  const suggestedFortnightly = suggestedFortnightlySetAside(bill, today)
  const dashOffset = CIRCUMFERENCE * (1 - progress / 100)

  const ringRef = useRef<SVGCircleElement>(null)
  useEffect(() => {
    if (!ringRef.current) return
    gsap.fromTo(
      ringRef.current,
      { strokeDashoffset: CIRCUMFERENCE },
      { strokeDashoffset: dashOffset, duration: 1.2, delay: delay + 0.15, ease: 'power2.out' }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashOffset])

  return (
    <StatCard label={bill.name} glow={bill.inCredit ? 'success' : 'cyan'} delay={delay}>
      {(onEdit || onRemove) && (
        <div className="absolute top-3 right-3 z-20 flex gap-2">
          {onEdit && (
            <button onClick={onEdit} className="text-white/30 hover:text-cyan-300" aria-label={`Edit ${bill.name}`}>
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onRemove && (
            <button onClick={onRemove} className="text-white/30 hover:text-rose-400" aria-label={`Remove ${bill.name}`}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
      {bill.smoothingEnabled === false && (
        <span className="absolute top-3 left-1/2 -translate-x-1/2 z-20 text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50 border border-white/15">
          smoothing off
        </span>
      )}
      <div className="mt-4 flex flex-col md:flex-row items-center gap-6">
        {/* Gauge */}
        <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
          <svg width={140} height={140} viewBox="0 0 140 140" className="-rotate-90">
            <circle cx={70} cy={70} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} />
            <circle
              ref={ringRef}
              cx={70}
              cy={70}
              r={RADIUS}
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE}
            />
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] uppercase tracking-wide text-white/40">Projected</span>
            <span className="text-xl font-bold tabular-nums text-white">
              <CountUp value={bill.projectedCharge} prefix="$" decimals={2} />
            </span>
            <span className="text-[10px] text-white/35 flex items-center gap-1 mt-0.5">
              <Clock className="w-2.5 h-2.5" /> {daysLeft}d left
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 w-full space-y-3">
          <div className="flex justify-between text-xs text-white/40">
            <span>{formatShortDate(bill.gaugePeriodStart)}</span>
            <span>{formatShortDate(bill.gaugePeriodEnd)}</span>
          </div>

          {bill.inCredit ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> In credit {formatCurrency(bill.creditAmount)} — no bill due right now.
            </div>
          ) : bill.pendingBill ? (
            (() => {
              const daysUntilDue = daysBetweenIso(today, bill.pendingBill.dueDate)
              const severity = dueDateSeverity(daysUntilDue)
              return (
                <div className={cn('rounded-lg border px-3 py-2 text-sm', PENDING_BILL_SEVERITY_CLASSES[severity])}>
                  <div className={cn('flex justify-between items-center font-semibold', PENDING_BILL_TEXT_CLASSES[severity])}>
                    <span className="flex items-center gap-2">
                      Bill due
                      <DueBadge dueDateIso={bill.pendingBill.dueDate} />
                    </span>
                    <span className="tabular-nums">{formatCurrency(bill.pendingBill.amount)}</span>
                  </div>
                  <div className="text-[11px] text-white/40 mt-0.5">
                    for {formatShortDate(bill.pendingBill.periodStart)} – {formatShortDate(bill.pendingBill.periodEnd)}
                  </div>
                  {/* #8 expanded — a real payment here reduces (or fully clears, with overpayment
                      booked as real credit) this bill's pending amount. */}
                  <div className="mt-2">
                    <RecordPaymentButton targetType="periodicBill" targetId={bill.id} targetLabel={bill.name} defaultAmount={bill.pendingBill.amount} />
                  </div>
                </div>
              )
            })()
          ) : null}

          <div className={cn('rounded-lg border px-3 py-2', 'border-cyan-400/30 bg-cyan-500/10')}>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-cyan-200/80">Suggested fortnightly set-aside</span>
              <span className="text-lg font-bold tabular-nums text-cyan-300">{formatCurrency(suggestedFortnightly)}</span>
            </div>
            <p className="text-[10px] text-white/35 mt-0.5">Smoothed across the current period so it's never one big lump sum.</p>
          </div>
        </div>
      </div>
    </StatCard>
  )
}
