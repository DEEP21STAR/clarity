import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { MoodIcon } from './MoodIcon'
import { SegmentedControl } from './SegmentedControl'
import { InsightsTicker } from './InsightsTicker'
import { DueBadge } from './DueBadge'
import {
  nzNetIncome, auNetIncome, generateInsights, monthlyEquivalent, computeCurrentHealthScore, buildDashboardHeadline,
  emergencyFundMonths, emergencyFundRunwayDate, nextMonthlyDueDate,
} from '@/lib/logic'
import { cn, formatCurrency, formatShortDate, todayIso } from '@/lib/utils'
import { isInsightSnoozed, snoozeInsight } from '@/lib/insightSnooze'
import { AlertTriangle, CheckCircle2, Info, GripVertical, ChevronUp, ChevronDown, Clock, Flame } from 'lucide-react'
import { fireHealthScoreConfetti } from '@/lib/confetti'
import { Sparkline } from './Sparkline'
import { BillIcon } from './BillIcons'
import { YearInReview } from './YearInReview'
import { DashboardForecastCard } from './DashboardForecastCard'
import { TakeawaySavings } from './TakeawaySavings'
import { FinancialTipOfDay } from './FinancialTipOfDay'
import { GettingStartedCard } from './GettingStartedCard'

/**
 * Renders the plain-language headline with weight/gradient emphasis on just
 * its key numbers ($ amounts, the "N/100" health score) — not the whole
 * sentence uniformly, per the specific ask this is presentation-only
 * splitting of a string that stays a single tested value in logic.ts.
 */
function renderHeadline(headline: string): ReactNode {
  const parts = headline.split(/(\$[\d.]+|\d+\/100)/g)
  return parts.map((part, i) =>
    /^(\$[\d.]+|\d+\/100)$/.test(part) ? (
      <span key={i} className="gradient-heading font-bold">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

export function Dashboard() {
  const { state, setMode, setCountry, setGrossAnnualIncome, setDashboardCardOrder } = useStore()
  const { mode, country, grossAnnualIncome, bills, debts, accounts } = state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Reconciles a saved dashboardCardOrder (from an earlier round, before this block existed)
  // by appending any new block id it's missing — otherwise a returning browser's existing
  // saved order would silently never render the new card at all. 'forecast' inserted right
  // after 'stats' (not appended to the end) so it reads as top-of-page, not an afterthought —
  // only for boards missing it; an existing custom order elsewhere is left alone.
  useEffect(() => {
    let order = state.dashboardCardOrder
    let changed = false
    if (!order.includes('forecast')) {
      const statsIdx = order.indexOf('stats')
      order = statsIdx === -1 ? [...order, 'forecast'] : [...order.slice(0, statsIdx + 1), 'forecast', ...order.slice(statsIdx + 1)]
      changed = true
    }
    if (!order.includes('takeaways')) {
      const statsIdx = order.indexOf('stats')
      order = statsIdx === -1 ? [...order, 'takeaways'] : [...order.slice(0, statsIdx + 1), 'takeaways', ...order.slice(statsIdx + 1)]
      changed = true
    }
    if (!order.includes('yearInReview')) {
      order = [...order, 'yearInReview']
      changed = true
    }
    if (changed) setDashboardCardOrder(order)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const net = useMemo(
    () => (country === 'NZ' ? nzNetIncome(grossAnnualIncome) : auNetIncome(grossAnnualIncome)),
    [country, grossAnnualIncome]
  )
  const monthlyNet = net.net / 12
  const monthlyBills = useMemo(
    () => bills.filter((b) => b.active).reduce((s, b) => s + monthlyEquivalent(b.amount, b.frequency), 0),
    [bills]
  )
  const savingsBalance = accounts.find((a) => a.id === 'savings')?.value ?? 0
  const leftover = monthlyNet - monthlyBills

  const healthScore = useMemo(
    () => computeCurrentHealthScore({ bills, creditCards: state.creditCards, debts, accounts, grossAnnualIncome, country }),
    [bills, state.creditCards, debts, accounts, grossAnnualIncome, country]
  )

  const headline = useMemo(() => buildDashboardHeadline(leftover, healthScore.score, healthScore.breakdown), [leftover, healthScore])

  // #17 — real star-shaped confetti the moment the score genuinely crosses INTO "healthy"
  // (same >=75 threshold the mood icon already uses) — not on every render, only the real
  // crossing, and not on first mount (that would fire for anyone who's already healthy).
  const wasHealthy = useRef<boolean | null>(null)
  useEffect(() => {
    const isHealthy = healthScore.score >= 75
    if (wasHealthy.current === false && isHealthy) fireHealthScoreConfetti()
    wasHealthy.current = isHealthy
  }, [healthScore.score])

  const allInsights = useMemo(
    () =>
      generateInsights({
        monthlyIncome: monthlyNet,
        monthlyExpenses: monthlyBills,
        bills,
        debts,
        savingsBalance,
      }),
    [monthlyNet, monthlyBills, bills, debts, savingsBalance]
  )

  // Round 21, item #7 — snoozed insights are filtered out here (not deleted from the source
  // list) — re-reads the real localStorage snooze state on every render, so a snooze
  // genuinely expiring mid-session brings the insight back without needing a reload.
  const today = todayIso()
  const [snoozeVersion, setSnoozeVersion] = useState(0)
  const insights = useMemo(
    () => allInsights.filter((i) => !isInsightSnoozed(i.id, today)),
    // snoozeVersion is a deliberate extra dependency — snoozing an insight doesn't change any
    // of the real inputs above, so without it the just-snoozed insight wouldn't disappear
    // until something else happened to re-render this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allInsights, today, snoozeVersion]
  )

  // Round 21, item #13 — the single largest active bill due within the next 14 days, sorted
  // by SIZE not date (the insights ticker already covers "what's due soonest" by date — this
  // answers the different question "what's going to hurt the most").
  const biggestUpcomingBill = useMemo(() => {
    const candidates = bills
      .filter((b) => b.active && b.frequency === 'monthly')
      .map((b) => ({ bill: b, dueDateIso: nextMonthlyDueDate(b.dueDay, today) }))
      .filter((x) => {
        const days = (new Date(x.dueDateIso + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 86400000
        return days >= 0 && days <= 14
      })
    if (candidates.length === 0) return null
    return candidates.sort((a, b) => b.bill.amount - a.bill.amount)[0]
  }, [bills, today])

  // Round 21, item #17 — a real calendar-date emergency-fund runway, not just the abstract
  // "months" sub-score already shown in the breakdown line below.
  const efMonths = useMemo(() => emergencyFundMonths(savingsBalance, monthlyBills), [savingsBalance, monthlyBills])
  const efRunwayDate = useMemo(() => emergencyFundRunwayDate(efMonths, today), [efMonths, today])

  // Round 21, item #14 — keyboard/touch-accessible reordering. Native HTML5 drag-and-drop
  // (the existing mechanism below) has no keyboard or touch-screen equivalent at all — these
  // up/down buttons are a real second way to reorder, not just a visual affordance.
  const moveCard = (id: string, direction: -1 | 1) => {
    const order = [...state.dashboardCardOrder]
    const from = order.indexOf(id)
    const to = from + direction
    if (from === -1 || to < 0 || to >= order.length) return
    ;[order[from], order[to]] = [order[to], order[from]]
    setDashboardCardOrder(order)
  }

  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) { setDraggingId(null); setDragOverId(null); return }
    const order = [...state.dashboardCardOrder]
    const from = order.indexOf(draggingId)
    const to = order.indexOf(targetId)
    if (from === -1 || to === -1) return
    order.splice(from, 1)
    order.splice(to, 0, draggingId)
    setDashboardCardOrder(order)
    setDraggingId(null)
    setDragOverId(null)
  }

  const blocks: Record<string, ReactNode> = {
    stats: (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Gross Annual Income" glow="cyan">
          <div className="mt-4 flex items-center gap-2">
            <span className="text-white/40">$</span>
            <input
              type="number"
              value={grossAnnualIncome}
              onChange={(e) => setGrossAnnualIncome(parseFloat(e.target.value) || 0)}
              className="bg-transparent text-3xl font-bold tabular-nums text-cyan-200 outline-none border-b border-white/10 focus:border-cyan-400/60 w-full"
            />
          </div>
          <p className="text-xs text-white/40 mt-2">Editable — drives tax/net calculations below.</p>
        </StatCard>
        <StatCard label="Net Monthly Income" glow="success" delay={0.05}>
          <div className="mt-4 text-3xl font-bold tabular-nums ux-hero-number">
            <CountUp value={monthlyNet} prefix="$" />
          </div>
          {monthlyNet > 0 && (
            <div className="mt-3" role="img" aria-label={`Bills ${formatCurrency(monthlyBills)} of ${formatCurrency(monthlyNet)} net monthly income; ${formatCurrency(leftover)} left`}>
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden flex">
                <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${Math.min(100, (monthlyBills / monthlyNet) * 100)}%` }} />
                {leftover > 0 && <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 flex-1" />}
              </div>
              <div className="mt-1.5 flex justify-between gap-2 text-xs text-white/70">
                <span>Bills {formatCurrency(monthlyBills)}</span>
                <span>{leftover >= 0 ? 'Left' : 'Short'} {formatCurrency(Math.abs(leftover))}</span>
              </div>
            </div>
          )}
          <p className="text-xs text-white/40 mt-2">
            After {country} tax {country === 'NZ' ? '+ ACC levy' : '+ Medicare levy − LITO'}.
          </p>
        </StatCard>
        <StatCard label="Fixed Bills / Month" glow="amber" delay={0.1}>
          <div className="mt-4 flex items-center gap-3">
            <span className="ux-icon-chip" style={{ ['--chip-color' as string]: '#fbbf24' }}>
              <BillIcon name={bills.find((b) => b.active)?.name ?? ''} className="w-5 h-5" />
            </span>
            <div className="text-3xl font-bold tabular-nums ux-hero-number" style={{ ['--ux-accent-a' as string]: '#fbbf24', ['--ux-accent-b' as string]: '#fb923c' }}>
              <CountUp value={monthlyBills} prefix="$" />
            </div>
          </div>
          <p className="text-xs text-white/40 mt-2">{bills.filter((b) => b.active).length} active recurring bills.</p>
        </StatCard>
      </div>
    ),
    takeaways: <TakeawaySavings />,
    forecast: <DashboardForecastCard />,
    health: (
      <StatCard label="Financial Health Score" glow={healthScore.score >= 75 ? 'success' : healthScore.score >= 40 ? 'amber' : 'danger'} copyable>
        <div className="mt-4 flex items-center gap-6">
          <HealthRings breakdown={healthScore.breakdown}>
            <MoodIcon score={healthScore.score} size={44} />
          </HealthRings>
          <div className="min-w-0">
            <div className="text-5xl font-black tabular-nums ux-hero-number"><CountUp value={healthScore.score} decimals={0} />/100</div>
            {state.healthScoreHistory.length >= 2 ? (
              <div className="mt-2"><Sparkline values={state.healthScoreHistory.slice(-30).map((h) => h.score)} label={`Health score trend over ${Math.min(30, state.healthScoreHistory.length)} days`} /></div>
            ) : (
              <p className="mt-1 text-xs text-white/60">Trend appears after 2 days of data</p>
            )}
            <p className="text-xs text-white/40 mt-1">
              Savings rate {healthScore.breakdown.savingsRate.toFixed(0)} · Debt-to-income {healthScore.breakdown.debtToIncome.toFixed(0)} · Bill coverage {healthScore.breakdown.billCoverage.toFixed(0)} · Emergency fund {healthScore.breakdown.emergencyFund.toFixed(0)}
              <span className="block mt-1 text-white/30">Weighted 30/25/25/20 — see calcFinancialHealthScore() for the exact documented formula.</span>
              {efRunwayDate && (
                <span className="flex items-center gap-1 mt-1.5 text-cyan-300/80">
                  <Clock className="w-3 h-3" /> Savings alone cover fixed bills until ≈ {formatShortDate(efRunwayDate)} at zero income.
                </span>
              )}
            </p>
          </div>
        </div>
      </StatCard>
    ),
    tax: (
      <StatCard label="Tax Breakdown" glow="purple">
        <TaxBar net={net.net} tax={net.tax} levy={country === 'NZ' ? (net as any).accLevy : (net as any).medicareLevy} levyLabel={country === 'NZ' ? 'ACC' : 'Medicare'} />
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Metric label="Gross" value={net.gross} />
          <Metric label="Income Tax" value={net.tax} tone="danger" />
          {country === 'NZ' ? (
            <Metric label="ACC Levy" value={(net as any).accLevy} tone="danger" />
          ) : (
            <>
              <Metric label="Medicare Levy" value={(net as any).medicareLevy} tone="danger" />
              <Metric label="LITO Offset" value={(net as any).lito} tone="success" />
            </>
          )}
          <Metric label="Net" value={net.net} tone="success" />
        </div>
      </StatCard>
    ),
    insights: (
      <StatCard label="Insights" glow="pink">
        {/* Round 21, item #13 — biggest single upcoming bill in the next 14 days, sorted by
            size (a different, complementary question to the ticker's "soonest by date"). */}
        {biggestUpcomingBill && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-rose-400/20 bg-rose-400/5 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Flame className="w-4 h-4 text-rose-300 shrink-0" />
              <span className="text-sm text-white/70 truncate">
                Biggest bill coming up: <strong className="text-white">{biggestUpcomingBill.bill.name}</strong> — {formatCurrency(biggestUpcomingBill.bill.amount)}
              </span>
            </div>
            <DueBadge dueDateIso={biggestUpcomingBill.dueDateIso} className="shrink-0" />
          </div>
        )}
        <div className="mt-4 space-y-2">
          {insights.map((insight) => (
            <div key={insight.id} className="group relative flex items-start gap-3 text-sm rounded-xl border border-white/10 bg-white/[0.03] pl-4 pr-3 py-2.5 overflow-hidden">
              <span aria-hidden="true" className="absolute left-0 inset-y-0 w-1" style={{ background: SEV[insight.severity].color, boxShadow: `0 0 12px ${SEV[insight.severity].color}` }} />
              <span className="ux-icon-chip" style={{ ['--chip-color' as string]: SEV[insight.severity].color }}>
                {insight.severity === 'info' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </span>
              <span className="text-white/80 flex-1 min-w-0 self-center">{insight.message}</span>
              {/* Round 21, item #7 — real 7-day snooze, only offered for warning/info (never
                  "critical" — overspending shouldn't be silenceable for a week). */}
              {insight.severity !== 'critical' && (
                <button
                  onClick={() => { snoozeInsight(insight.id, today); setSnoozeVersion((v) => v + 1) }}
                  title="Snooze this insight for 7 days"
                  className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-cyan-300 shrink-0 transition-opacity"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {insights.length === 0 && allInsights.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-white/50">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> All caught up — {allInsights.length} insight{allInsights.length === 1 ? '' : 's'} snoozed for now.
            </div>
          )}
          {allInsights.length === 0 && (
            <div className="ux-empty">
              <svg width="72" height="40" viewBox="0 0 72 40" aria-hidden="true">
                <path d="M12 28 L36 10 L60 24" fill="none" stroke="var(--ux-accent-a)" strokeOpacity=".5" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="12" cy="28" r="4" fill="var(--ux-accent-a)" /><circle cx="36" cy="10" r="5" fill="var(--ux-accent-b)" /><circle cx="60" cy="24" r="3.5" fill="var(--ux-accent-a)" />
              </svg>
              <span className="flex items-center gap-1.5"><Info className="w-4 h-4" /> No insights yet — add bills, debts and balances to generate real ones.</span>
            </div>
          )}
        </div>
      </StatCard>
    ),
    yearInReview: <YearInReview />,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="gradient-heading text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-white/50 mt-1">Net income, fixed costs, and rule-based insights at a glance.</p>
        </div>
        <div className="flex gap-2">
          {/* Overnight audit found the same real gap as the header's household toggle: mode
              only actually filters Transactions/the accountant CSV export (see
              DataExportPanel.tsx) — it changes nothing else on THIS tab, or anywhere else.
              Toggling it right here, on the tab where it visibly does nothing, is exactly the
              "is this broken?" moment the audit was looking for — honest tooltip instead of
              silent no-op. Country, right next to it, genuinely does recompute this tab's
              tax/net figures (verified live) and needs no such disclosure. */}
          <span title="Only affects Transactions and the accountant CSV export (Tools) — this tab's income/bills figures are the same in both modes.">
            <SegmentedControl value={mode} onChange={setMode} options={[{ value: 'personal', label: 'Personal' }, { value: 'business', label: 'Business' }]} />
          </span>
          <SegmentedControl value={country} onChange={setCountry} options={[{ value: 'NZ', label: 'NZ' }, { value: 'AU', label: 'AU' }]} />
        </div>
      </div>

      {/* Plain-language headline — the literal answer in words, before any number. Base
          text bumped to full-white/semibold (the prior text-white/90 + font-medium combo
          read as flat grey per direct feedback); the dollar figure and health-score
          fraction specifically get gradient emphasis via renderHeadline() above. */}
      <p className="text-xl md:text-2xl font-semibold text-white leading-snug">{renderHeadline(headline)}</p>

      <GettingStartedCard />

      <FinancialTipOfDay />

      <InsightsTicker />

      {/* Draggable card blocks — order persisted in state.dashboardCardOrder */}
      {state.dashboardCardOrder.map((id) => (
        <div
          key={id}
          draggable
          onDragStart={() => setDraggingId(id)}
          onDragOver={(e) => { e.preventDefault(); setDragOverId(id) }}
          onDragLeave={() => setDragOverId((v) => (v === id ? null : v))}
          onDrop={() => handleDrop(id)}
          onDragEnd={() => { setDraggingId(null); setDragOverId(null) }}
          className={cn(
            draggingId === id && 'dragging',
            // #23 — real ghost-card preview at the drop target: the outline (existing) PLUS a
            // subtle scale/rotate wobble showing where the dragged card would actually land.
            dragOverId === id && draggingId !== id && 'drag-over drag-ghost'
          )}
        >
          <div className="drag-handle flex items-center gap-1.5 mb-1.5 text-[10px] text-white/25 uppercase tracking-wide">
            <GripVertical className="w-3 h-3" /> drag to reorder
            {/* Round 21, item #14 — native HTML5 drag-and-drop has no keyboard or touch
                equivalent at all; these buttons are a real second way to reorder, always
                visible (not hover-only), so keyboard/touch users aren't left guessing this
                exists. */}
            <span className="flex items-center gap-0.5 ml-1">
              <button
                onClick={() => moveCard(id, -1)}
                disabled={state.dashboardCardOrder.indexOf(id) === 0}
                title="Move card up"
                aria-label={`Move ${id} card up`}
                className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => moveCard(id, 1)}
                disabled={state.dashboardCardOrder.indexOf(id) === state.dashboardCardOrder.length - 1}
                title="Move card down"
                aria-label={`Move ${id} card down`}
                className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </span>
          </div>
          {blocks[id]}
        </div>
      ))}
    </div>
  )
}

const SEV = {
  critical: { color: '#fb7185' },
  warning: { color: '#fbbf24' },
  info: { color: '#34d399' },
} as const

/** Four sub-score arcs (savings rate, debt-to-income, bill coverage, emergency fund) around the mood icon. Display only; values come straight from healthScore.breakdown. */
function HealthRings({ breakdown, children }: { breakdown: { savingsRate: number; debtToIncome: number; billCoverage: number; emergencyFund: number }; children: ReactNode }) {
  const rings = [
    { v: breakdown.savingsRate, c: '#22d3ee', n: 'Savings rate' },
    { v: breakdown.debtToIncome, c: '#a855f7', n: 'Debt-to-income' },
    { v: breakdown.billCoverage, c: '#fbbf24', n: 'Bill coverage' },
    { v: breakdown.emergencyFund, c: '#34d399', n: 'Emergency fund' },
  ]
  const size = 96
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={rings.map((r) => `${r.n} ${r.v.toFixed(0)}`).join(', ')}>
      <svg width={size} height={size} viewBox="0 0 96 96" className="-rotate-90">
        {rings.map((r, i) => {
          const rad = 45 - i * 7
          const C = 2 * Math.PI * rad
          const pct = Math.min(100, Math.max(0, r.v)) / 100
          return (
            <g key={r.n}>
              <circle cx="48" cy="48" r={rad} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4.5" />
              <circle cx="48" cy="48" r={rad} fill="none" stroke={r.c} strokeWidth="4.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
            </g>
          )
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

/** One 100% stacked bar of the figures the grid below already shows. Normalised for display only; nothing is recomputed. */
function TaxBar({ net, tax, levy, levyLabel }: { net: number; tax: number; levy: number; levyLabel: string }) {
  const parts = [
    { l: 'Net', v: Math.max(0, net), c: 'bg-emerald-400' },
    { l: 'Income Tax', v: Math.max(0, tax), c: 'bg-rose-400' },
    { l: levyLabel, v: Math.max(0, levy), c: 'bg-amber-400' },
  ]
  const sum = parts.reduce((a, p) => a + p.v, 0)
  if (sum <= 0) return null
  return (
    <div className="mt-4" role="img" aria-label={parts.map((p) => `${p.l} ${((p.v / sum) * 100).toFixed(0)}%`).join(', ')}>
      <div className="h-3 rounded-full overflow-hidden flex bg-white/10">
        {parts.map((p) => <div key={p.l} className={p.c} style={{ width: `${(p.v / sum) * 100}%` }} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/70">
        {parts.map((p) => <span key={p.l}>{p.l} {((p.v / sum) * 100).toFixed(0)}%</span>)}
      </div>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'danger' | 'success' }) {
  return (
    <div>
      <div className="text-xs text-white/40 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${tone === 'danger' ? 'text-rose-300' : tone === 'success' ? 'text-emerald-300' : 'text-white'}`}>
        {formatCurrency(value)}
      </div>
    </div>
  )
}
