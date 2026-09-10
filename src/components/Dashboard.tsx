import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { MoodIcon } from './MoodIcon'
import { SegmentedControl } from './SegmentedControl'
import { InsightsTicker } from './InsightsTicker'
import { nzNetIncome, auNetIncome, generateInsights, monthlyEquivalent, calcFinancialHealthScore, emergencyFundMonths, buildDashboardHeadline } from '@/lib/logic'
import { cn, formatCurrency } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, Info, GripVertical } from 'lucide-react'

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

  const healthScore = useMemo(() => {
    const savingsRate = monthlyNet > 0 ? (monthlyNet - monthlyBills) / monthlyNet : 0
    const totalDebtBalance = debts.reduce((s, d) => s + d.balance, 0) + state.creditCards.reduce((s, c) => s + c.balance, 0)
    const annualNetIncome = net.net
    const debtToIncome = annualNetIncome > 0 ? totalDebtBalance / annualNetIncome : 1
    const billCoverageRatio = monthlyBills > 0 ? monthlyNet / monthlyBills : 2
    const efMonths = emergencyFundMonths(savingsBalance, monthlyBills)
    return calcFinancialHealthScore({ savingsRate, debtToIncome, billCoverageRatio, emergencyFundMonths: efMonths })
  }, [monthlyNet, monthlyBills, debts, state.creditCards, net.net, savingsBalance])

  const headline = useMemo(() => buildDashboardHeadline(leftover, healthScore.score, healthScore.breakdown), [leftover, healthScore])

  const insights = useMemo(
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
          <div className="mt-4 text-3xl font-bold text-emerald-300 tabular-nums">
            <CountUp value={monthlyNet} prefix="$" />
          </div>
          <p className="text-xs text-white/40 mt-2">
            After {country} tax {country === 'NZ' ? '+ ACC levy' : '+ Medicare levy − LITO'}.
          </p>
        </StatCard>
        <StatCard label="Fixed Bills / Month" glow="amber" delay={0.1}>
          <div className="mt-4 text-3xl font-bold text-amber-300 tabular-nums">
            <CountUp value={monthlyBills} prefix="$" />
          </div>
          <p className="text-xs text-white/40 mt-2">{bills.filter((b) => b.active).length} active recurring bills.</p>
        </StatCard>
      </div>
    ),
    health: (
      <StatCard label="Financial Health Score" glow={healthScore.score >= 75 ? 'success' : healthScore.score >= 40 ? 'amber' : 'danger'} tilt={false}>
        <div className="mt-4 flex items-center gap-6">
          <MoodIcon score={healthScore.score} size={64} />
          <div>
            <div className="text-5xl font-black tabular-nums text-white"><CountUp value={healthScore.score} decimals={0} />/100</div>
            <p className="text-xs text-white/40 mt-1">
              Savings rate {healthScore.breakdown.savingsRate.toFixed(0)} · Debt-to-income {healthScore.breakdown.debtToIncome.toFixed(0)} · Bill coverage {healthScore.breakdown.billCoverage.toFixed(0)} · Emergency fund {healthScore.breakdown.emergencyFund.toFixed(0)}
              <span className="block mt-1 text-white/30">Weighted 30/25/25/20 — see calcFinancialHealthScore() for the exact documented formula.</span>
            </p>
          </div>
        </div>
      </StatCard>
    ),
    tax: (
      <StatCard label="Tax Breakdown" glow="purple" tilt={false}>
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
      <StatCard label="Insights" glow="pink" tilt={false}>
        <div className="mt-4 space-y-2">
          {insights.map((insight) => (
            <div key={insight.id} className="flex items-start gap-2 text-sm">
              {insight.severity === 'critical' && <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />}
              {insight.severity === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />}
              {insight.severity === 'info' && <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />}
              <span className="text-white/70">{insight.message}</span>
            </div>
          ))}
          {insights.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Info className="w-4 h-4" /> No insights yet — add bills, debts and balances to generate real ones.
            </div>
          )}
        </div>
      </StatCard>
    ),
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="gradient-heading text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-white/50 mt-1">Net income, fixed costs, and rule-based insights at a glance.</p>
        </div>
        <div className="flex gap-2">
          <SegmentedControl value={mode} onChange={setMode} options={[{ value: 'personal', label: 'Personal' }, { value: 'business', label: 'Business' }]} />
          <SegmentedControl value={country} onChange={setCountry} options={[{ value: 'NZ', label: 'NZ' }, { value: 'AU', label: 'AU' }]} />
        </div>
      </div>

      {/* Plain-language headline — the literal answer in words, before any number. Base
          text bumped to full-white/semibold (the prior text-white/90 + font-medium combo
          read as flat grey per direct feedback); the dollar figure and health-score
          fraction specifically get gradient emphasis via renderHeadline() above. */}
      <p className="text-xl md:text-2xl font-semibold text-white leading-snug">{renderHeadline(headline)}</p>

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
          className={cn(draggingId === id && 'dragging', dragOverId === id && draggingId !== id && 'drag-over')}
        >
          <div className="drag-handle flex items-center gap-1 mb-1.5 text-[10px] text-white/25 uppercase tracking-wide">
            <GripVertical className="w-3 h-3" /> drag to reorder
          </div>
          {blocks[id]}
        </div>
      ))}
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
