import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { AccountsPanel } from './AccountsPanel'
import { calcNetWorth } from '@/lib/logic'
import { formatCurrency } from '@/lib/utils'

export function NetWorth() {
  const { state } = useStore()
  const breakdown = useMemo(() => calcNetWorth(state.accounts, state.creditCards, state.debts), [state.accounts, state.creditCards, state.debts])

  const chartData = useMemo(
    () => state.netWorthHistory.map((h) => ({ date: h.date.slice(5), netWorth: h.netWorth, assets: h.totalAssets, liabilities: h.totalLiabilities })),
    [state.netWorthHistory]
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Net Worth</h2>
        <p className="text-sm text-white/50 mt-1">Assets minus liabilities, tracked over time — snapshotted once per day this dashboard is open.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Assets" glow="cyan">
          <div className="mt-4 text-3xl font-bold text-cyan-300 tabular-nums"><CountUp value={breakdown.totalAssets} prefix="$" /></div>
        </StatCard>
        <StatCard label="Total Liabilities" glow="danger" delay={0.05}>
          <div className="mt-4 text-3xl font-bold text-rose-300 tabular-nums"><CountUp value={breakdown.totalLiabilities} prefix="$" /></div>
          <p className="text-xs text-white/40 mt-2">GEM VISA card balances + tracked Debts.</p>
        </StatCard>
        <StatCard label="Net Worth" glow={breakdown.netWorth >= 0 ? 'success' : 'danger'} delay={0.1}>
          <div className={`mt-4 text-3xl font-bold tabular-nums ${breakdown.netWorth >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            <CountUp value={breakdown.netWorth} prefix="$" />
          </div>
        </StatCard>
      </div>

      <StatCard label="Net Worth Over Time" glow="purple" tilt={false}>
        <div className="mt-4" style={{ width: '100%', height: 260 }}>
          {chartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#0b0d14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(v) => formatCurrency(Number(v))}
                />
                <Line type="monotone" dataKey="netWorth" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 3, fill: '#22d3ee' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-white/40">
              Net worth history builds a real point each day you open Clarity — check back after a couple of days for a real trend line.
            </div>
          )}
        </div>
      </StatCard>

      <AccountsPanel />
    </div>
  )
}
