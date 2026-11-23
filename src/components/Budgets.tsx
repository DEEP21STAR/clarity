import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { convertPeriodAmount, monthlyEquivalent, nzNetIncome, auNetIncome, monthlySpendByCategory, categoryColor, generateCategoryTrendInsights } from '@/lib/logic'
import type { Period } from '@/lib/types'
import { cn, formatCurrency } from '@/lib/utils'
import { SegmentedControl } from './SegmentedControl'
import { TrendArrow } from './TrendArrow'

const PERIODS: Period[] = ['daily', 'weekly', 'monthly', 'quarterly', 'annual']

const CATEGORY_COLORS: Record<string, string> = {
  housing: '#a855f7',
  utilities: '#22d3ee',
  insurance: '#34d399',
  subscription: '#ec4899',
  debt: '#ff2d55',
  other: '#f59e0b',
}

export function Budgets() {
  const { state } = useStore()
  const [period, setPeriod] = useState<Period>('monthly')
  const [activeSlice, setActiveSlice] = useState<string | null>(null)
  const categorySpend = useMemo(() => monthlySpendByCategory(state.transactions), [state.transactions])
  const trendInsights = useMemo(() => generateCategoryTrendInsights(categorySpend), [categorySpend])

  const net = useMemo(
    () => (state.country === 'NZ' ? nzNetIncome(state.grossAnnualIncome) : auNetIncome(state.grossAnnualIncome)),
    [state.country, state.grossAnnualIncome]
  )
  const monthlyBills = useMemo(
    () => state.bills.filter((b) => b.active).reduce((s, b) => s + monthlyEquivalent(b.amount, b.frequency), 0),
    [state.bills]
  )
  const incomeForPeriod = convertPeriodAmount(net.net / 12, period)
  const billsForPeriod = convertPeriodAmount(monthlyBills, period)
  const leftover = incomeForPeriod - billsForPeriod

  const donutData = useMemo(
    () =>
      (['housing', 'utilities', 'insurance', 'subscription', 'debt', 'other'] as const)
        .map((cat) => ({
          name: cat,
          value: state.bills.filter((b) => b.active && b.category === cat).reduce((s, b) => s + monthlyEquivalent(b.amount, b.frequency), 0),
          color: CATEGORY_COLORS[cat],
        }))
        .filter((d) => d.value > 0),
    [state.bills]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="gradient-heading text-2xl font-bold tracking-tight">Budgets</h2>
          <p className="text-sm text-white/50 mt-1">Income vs fixed bills across every period view.</p>
        </div>
        <SegmentedControl value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: p }))} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label={`Net Income / ${period}`} glow="success">
          <div className="mt-4 text-3xl font-bold text-emerald-300 tabular-nums"><CountUp value={incomeForPeriod} prefix="$" /></div>
        </StatCard>
        <StatCard label={`Fixed Bills / ${period}`} glow="amber" delay={0.05}>
          <div className="mt-4 text-3xl font-bold text-amber-300 tabular-nums"><CountUp value={billsForPeriod} prefix="$" /></div>
        </StatCard>
        <StatCard label={`Leftover / ${period}`} glow={leftover < 0 ? 'danger' : 'cyan'} delay={0.1}>
          <div className={cn('mt-4 text-3xl font-bold tabular-nums', leftover < 0 ? 'text-rose-300' : 'text-cyan-300')}>
            <CountUp value={leftover} prefix="$" />
          </div>
        </StatCard>
      </div>

      <StatCard label="Bill Category Breakdown" glow="purple">
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="space-y-2">
            {(['housing', 'utilities', 'insurance', 'subscription', 'debt', 'other'] as const).map((cat) => {
              const total = state.bills.filter((b) => b.active && b.category === cat).reduce((s, b) => s + monthlyEquivalent(b.amount, b.frequency), 0)
              const pct = monthlyBills > 0 ? (total / monthlyBills) * 100 : 0
              if (total === 0) return null
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs text-white/50 capitalize mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[cat] }} />
                      {cat}
                    </span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={2}
                  onClick={(d) => setActiveSlice((cur) => (cur === d.name ? null : (d.name as string) ?? null))}
                  className="cursor-pointer"
                >
                  {/* #25 — a clicked slice "explodes" (pops outward + glows) into a detail view below. */}
                  {donutData.map((d) => (
                    <Cell
                      key={d.name}
                      fill={d.color}
                      stroke="none"
                      className={activeSlice === d.name ? 'donut-slice-active' : undefined}
                      style={{ transition: 'transform 0.25s ease-out', transform: activeSlice === d.name ? 'scale(1.08)' : 'scale(1)', transformOrigin: 'center', color: d.color }}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0b0d14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  formatter={(v) => formatCurrency(Number(v))}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        {activeSlice && (() => {
          const slice = donutData.find((d) => d.name === activeSlice)
          if (!slice) return null
          const billsInCategory = state.bills.filter((b) => b.active && b.category === activeSlice)
          return (
            <div className="mt-4 rounded-lg border p-3" style={{ borderColor: `${slice.color}55`, background: `${slice.color}14` }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold capitalize" style={{ color: slice.color }}>{activeSlice} — {formatCurrency(slice.value)}/mo</span>
                <button onClick={() => setActiveSlice(null)} className="text-white/30 hover:text-white text-xs">Close</button>
              </div>
              <div className="mt-2 space-y-1">
                {billsInCategory.map((b) => (
                  <div key={b.id} className="flex justify-between text-xs text-white/60">
                    <span>{b.name}</span>
                    <span className="tabular-nums">{formatCurrency(monthlyEquivalent(b.amount, b.frequency))}/mo</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </StatCard>

      {/* #5 — real month-over-month spend trend PER CATEGORY, from actual imported transactions.
          Deliberately separate from the bill-category donut above (free-text CSV categories have
          no guaranteed overlap with the fixed bill-category enum). */}
      <StatCard label="Category Spend Trend" glow="cyan" tooltip="Real month-over-month totals per category, from imported transactions — separate from the Bill Category Breakdown above since CSV categories are free text.">
        {categorySpend.length === 0 ? (
          <p className="mt-4 text-sm text-white/40">Import a bank CSV on the Transactions tab to see real category spend trends here.</p>
        ) : (
          <>
            {/* #45 — real trend-arrow-backed textual insights, computed from the actual series above, not invented. */}
            {trendInsights.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {trendInsights.map((i) => (
                  <div key={i.id} className={`text-xs flex items-center gap-1.5 ${i.severity === 'warning' ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {i.severity === 'warning' ? '▲' : '▼'} {i.message}
                  </div>
                ))}
              </div>
            )}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {categorySpend.slice(0, 6).map((series) => {
              const color = categoryColor(series.category)
              const latest = series.points[series.points.length - 1]
              const previous = series.points.length >= 2 ? series.points[series.points.length - 2] : null
              return (
                <div key={series.category} className="rounded-lg border border-white/5 bg-black/20 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-white/70">
                      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                      {series.category}
                    </span>
                    <span className="tabular-nums text-white/50">{formatCurrency(latest.total)} this month</span>
                  </div>
                  {/* #24 — real trend arrow vs the actual previous month, not invented. */}
                  {previous && <TrendArrow current={latest.total} previous={previous.total} goodDirection="down" suffix=" vs last month" />}
                  <div className="mt-1" style={{ height: 36 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series.points}>
                        <Line type="monotone" dataKey="total" stroke={color} strokeWidth={2} dot={false} isAnimationActive />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })}
          </div>
          </>
        )}
      </StatCard>
    </div>
  )
}
