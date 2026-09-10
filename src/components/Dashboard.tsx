import { useMemo } from 'react'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { MoodIcon } from './MoodIcon'
import { nzNetIncome, auNetIncome, generateInsights, monthlyEquivalent, calcFinancialHealthScore, emergencyFundMonths } from '@/lib/logic'
import { formatCurrency } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'

export function Dashboard() {
  const { state, setMode, setCountry, setGrossAnnualIncome } = useStore()
  const { mode, country, grossAnnualIncome, bills, debts, accounts } = state

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

  const healthScore = useMemo(() => {
    const savingsRate = monthlyNet > 0 ? (monthlyNet - monthlyBills) / monthlyNet : 0
    const totalDebtBalance = debts.reduce((s, d) => s + d.balance, 0) + state.creditCards.reduce((s, c) => s + c.balance, 0)
    const annualNetIncome = net.net
    const debtToIncome = annualNetIncome > 0 ? totalDebtBalance / annualNetIncome : 1
    const billCoverageRatio = monthlyBills > 0 ? monthlyNet / monthlyBills : 2
    const efMonths = emergencyFundMonths(savingsBalance, monthlyBills)
    return calcFinancialHealthScore({ savingsRate, debtToIncome, billCoverageRatio, emergencyFundMonths: efMonths })
  }, [monthlyNet, monthlyBills, debts, state.creditCards, net.net, savingsBalance])

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Dashboard</h2>
          <p className="text-sm text-white/50 mt-1">Net income, fixed costs, and rule-based insights at a glance.</p>
        </div>
        <div className="flex gap-2">
          <ToggleGroup value={mode} options={[{ v: 'personal', l: 'Personal' }, { v: 'business', l: 'Business' }]} onChange={(v) => setMode(v as any)} />
          <ToggleGroup value={country} options={[{ v: 'NZ', l: 'NZ' }, { v: 'AU', l: 'AU' }]} onChange={(v) => setCountry(v as any)} />
        </div>
      </div>

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

function ToggleGroup({ value, options, onChange }: { value: string; options: { v: string; l: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-full border border-white/10 overflow-hidden">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-3 py-1.5 text-xs font-medium transition-all ${
            value === o.v ? 'bg-gradient-to-r from-cyan-400 to-purple-500 text-black' : 'text-white/50 hover:text-white'
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}
