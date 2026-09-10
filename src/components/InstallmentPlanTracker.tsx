import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { StatCard } from './StatCard'
import { getPlanSeverity, planProgressPercent, requiredMonthlyPayment, planPayoffWithExtra, daysBetweenIso } from '@/lib/logic'
import { cn, formatCurrency, todayIso } from '@/lib/utils'
import type { CreditCardAccount, InstallmentPlan, DeviceRepayment } from '@/lib/types'
import { AlertTriangle, Flame, CheckCircle2, Sliders } from 'lucide-react'
import { BillIcon } from './BillIcons'
import { DueBadge } from './DueBadge'

/** One installment plan card — skinned in the app's neon-aurora language, inspired by (not copied from) Latitude's "My Plans" UI. */
export function InstallmentPlanCard({ plan, delay = 0, expiredPlanRate = 0 }: { plan: InstallmentPlan; delay?: number; expiredPlanRate?: number }) {
  const severity = getPlanSeverity(plan)
  const progress = planProgressPercent(plan)
  const monthly = requiredMonthlyPayment(plan)
  const ref = useRef<HTMLDivElement>(null)
  const [extra, setExtra] = useState(0)
  const [showWhatIf, setShowWhatIf] = useState(false)
  const payoff = planPayoffWithExtra(plan, extra, plan.expired ? expiredPlanRate : 0)
  const baselinePayoff = planPayoffWithExtra(plan, 0, plan.expired ? expiredPlanRate : 0)

  useEffect(() => {
    if (!ref.current) return
    gsap.fromTo(ref.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, delay, ease: 'power3.out' })
  }, [delay])

  const barGradient =
    severity === 'red' ? 'from-rose-500 to-pink-600' : severity === 'amber' ? 'from-amber-400 to-orange-500' : 'from-cyan-400 to-purple-500'
  const borderClass =
    severity === 'red' ? 'border-rose-500/50' : severity === 'amber' ? 'border-amber-400/40' : 'border-white/10'

  return (
    <div
      ref={ref}
      id={`plan-${plan.id}`}
      className={cn(
        'rounded-xl border bg-black/30 p-4',
        borderClass,
        severity === 'red' && 'plan-expired-alert'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-white/85">{plan.name}</span>
        {severity === 'red' && (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0">
            <Flame className="w-3 h-3" /> Active High-Interest
          </span>
        )}
        {severity === 'amber' && (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/40 shrink-0">
            <AlertTriangle className="w-3 h-3" /> Expiry Risk
          </span>
        )}
        {severity === 'normal' && (
          <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300/80 border border-emerald-400/20 shrink-0">
            <CheckCircle2 className="w-3 h-3" /> On Track
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between text-sm">
        <span className="text-white/50">
          {formatCurrency(plan.remaining)} <span className="text-white/30">of {formatCurrency(plan.total)}</span>
        </span>
        <span className="text-white/40 text-xs">
          {plan.expired ? 'expired' : `${plan.monthsRemaining}/${plan.monthsTotal} mo left`}
        </span>
      </div>

      <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
        <div className={cn('h-full rounded-full bg-gradient-to-r', barGradient)} style={{ width: `${progress}%` }} />
      </div>

      {plan.remaining > plan.total && (
        <p className="mt-2 text-[11px] text-rose-300">
          Balance now exceeds the original plan total — interest has already accrued since expiry.
        </p>
      )}

      {!plan.expired && (
        <p className={cn('mt-2 text-[11px]', severity === 'amber' ? 'text-amber-300' : 'text-white/40')}>
          Needs ~{formatCurrency(monthly)}/mo to clear on schedule.
        </p>
      )}

      <button
        onClick={() => setShowWhatIf((v) => !v)}
        className="mt-2 flex items-center gap-1 text-[11px] text-cyan-300/80 hover:text-cyan-200"
      >
        <Sliders className="w-3 h-3" /> {showWhatIf ? 'Hide' : 'What if I paid extra?'}
      </button>

      {showWhatIf && (
        <div className="mt-2 rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Extra per month</span>
            <span className="text-cyan-300 font-semibold tabular-nums">{formatCurrency(extra)}</span>
          </div>
          <input
            type="range" min={0} max={500} step={10} value={extra}
            onChange={(e) => setExtra(Number(e.target.value))}
            className="w-full mt-2 accent-cyan-400"
          />
          <p className="mt-2 text-[11px] text-white/60">
            {Number.isFinite(payoff.months)
              ? <>Payoff in <strong className="text-white">{payoff.months} mo</strong> (was {baselinePayoff.months} mo){plan.expired && <> · interest paid ~{formatCurrency(payoff.totalInterest)}</>}</>
              : 'Add a payment amount to see a payoff estimate.'}
          </p>
          {plan.expired && <p className="mt-1 text-[10px] text-white/30">Expired-plan estimate assumes a baseline payment of max($25, 2% of balance) plus your extra — Latitude doesn't expose a real per-plan minimum once expired.</p>}
        </div>
      )}
    </div>
  )
}

const DEALT_SESSION_KEY = 'clarity-plans-dealt'

/** Full card account panel — balance/available/min-payment header plus a grid of its plans. First render each session, plan cards "deal" in like being dealt a hand of cards. */
export function CreditCardAccountPanel({ card, delay = 0 }: { card: CreditCardAccount; delay?: number }) {
  const [dealt] = useState(() => {
    try {
      const already = sessionStorage.getItem(DEALT_SESSION_KEY) === '1'
      if (!already) sessionStorage.setItem(DEALT_SESSION_KEY, '1')
      return !already
    } catch {
      return false
    }
  })

  return (
    <StatCard label={card.name} glow="purple" tilt={false} delay={delay}>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-xs text-white/40 uppercase tracking-wide">Balance</div>
          <div className="text-lg font-bold tabular-nums text-white">{formatCurrency(card.balance)}</div>
        </div>
        <div>
          <div className="text-xs text-white/40 uppercase tracking-wide">Available</div>
          <div className="text-lg font-bold tabular-nums text-cyan-300">{formatCurrency(card.availableToSpend)}</div>
        </div>
        <div>
          <div className="text-xs text-white/40 uppercase tracking-wide">Min Payment</div>
          <div className="text-lg font-bold tabular-nums text-amber-300">
            {card.minPayment > 0 ? formatCurrency(card.minPayment) : 'None due'}
          </div>
          {card.minPaymentDueDate && (
            <div className="mt-1">
              <DueBadge daysUntil={daysBetweenIso(todayIso(), card.minPaymentDueDate)} />
            </div>
          )}
        </div>
        <div>
          <div className="text-xs text-white/40 uppercase tracking-wide">Expired Plan Rate</div>
          <div className="text-lg font-bold tabular-nums text-rose-300">{(card.rates.expiredPlanRate * 100).toFixed(2)}% p.a.</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {card.plans.map((plan, i) => (
          <div key={plan.id} className={dealt ? 'card-deal-in' : undefined} style={dealt ? { animationDelay: `${0.08 * i}s` } : undefined}>
            <InstallmentPlanCard plan={plan} delay={dealt ? 0 : 0.05 * i} expiredPlanRate={card.rates.expiredPlanRate} />
          </div>
        ))}
      </div>
    </StatCard>
  )
}

/** Plain device repayment card — deliberately neutral, no risk overlay (it's a straight repayment, not interest-bearing). */
export function DeviceRepaymentCard({ device, delay = 0 }: { device: DeviceRepayment; delay?: number }) {
  const progress = device.paymentsTotal > 0 ? ((device.paymentsTotal - device.paymentsRemaining) / device.paymentsTotal) * 100 : 0
  return (
    <StatCard label={device.name} glow="cyan" tilt={false} delay={delay}>
      <div className="mt-4 flex items-baseline justify-between text-sm">
        <span className="flex items-center gap-2 text-2xl font-bold tabular-nums text-cyan-200">
          <BillIcon name={device.name} className="w-5 h-5" />
          {formatCurrency(device.monthlyAmount)}<span className="text-sm text-white/40">/mo</span>
        </span>
        <span className="text-white/40 text-xs">{device.paymentsRemaining}/{device.paymentsTotal} payments left</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-xs text-white/40">{formatCurrency(device.remaining)} remaining — plain repayment, no interest.</p>
    </StatCard>
  )
}
