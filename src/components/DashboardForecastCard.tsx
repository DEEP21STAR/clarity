import { useMemo } from 'react'
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { useStore } from '@/lib/store'
import { projectBalanceSeries } from '@/lib/logic'
import { formatCurrency, todayIso } from '@/lib/utils'
import { TrendingDown, TrendingUp } from 'lucide-react'

/**
 * Round 21, item #2 — Deep's fresh complaint was specifically about the
 * DASHBOARD tab reading flat/grey with "no animation, forecast, moving
 * charts/graphs". Net Worth/Budgets/Debts already have real charts; this is
 * the Dashboard tab's own, so it's the first thing seen every session, not
 * just a launchpad. Deliberately NOT a copy of CashFlowChart (Upcoming
 * Payments) — same real projectBalanceSeries() engine underneath (real
 * paydays + real bills + periodic smoothing + one-off entries, walked day by
 * day), but rendered as a filled gradient AreaChart sparkline condensed to a
 * glanceable 14-day headline, distinct from the full 30/90d line chart.
 */
export function DashboardForecastCard() {
  const { state } = useStore()
  const today = todayIso()

  const startBalance = useMemo(
    () => state.accounts.filter((a) => a.countsTowardLiveFunds).reduce((s, a) => s + a.value, 0),
    [state.accounts]
  )

  const series = useMemo(
    () => projectBalanceSeries(startBalance, today, 14, state.bills, state.periodicBills, state.oneOffEntries),
    [startBalance, today, state.bills, state.periodicBills, state.oneOffEntries]
  )

  const chartData = series.map((p) => ({ date: p.date.slice(5), balance: p.balance }))
  const projected14 = series[series.length - 1]?.balance ?? startBalance
  const delta = projected14 - startBalance
  const lowestPoint = Math.min(...series.map((p) => p.balance))
  const goesNegative = lowestPoint < 0

  return (
    <StatCard label="14-Day Cash Forecast" glow={goesNegative ? 'danger' : delta >= 0 ? 'success' : 'amber'} tooltip="Real projection: today's live balance walked forward through actual paydays, bills and periodic smoothing — same engine as the full forecast on Upcoming Payments, condensed to a 2-week glance." copyable>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-3xl font-bold tabular-nums text-white">
            <CountUp value={projected14} prefix="$" />
          </div>
          <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {delta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {delta >= 0 ? '+' : ''}{formatCurrency(delta)} over 14 days
          </p>
        </div>
        {goesNegative && (
          <p className="text-xs text-rose-300 max-w-[14rem] text-right">⚠ Dips to {formatCurrency(lowestPoint)} in this window.</p>
        )}
      </div>

      <div className="mt-4" style={{ width: '100%', height: 96 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="dashForecastFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={goesNegative ? '#ff2d55' : '#22d3ee'} stopOpacity={0.45} />
                <stop offset="100%" stopColor={goesNegative ? '#ff2d55' : '#22d3ee'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <ReferenceLine y={0} stroke="rgba(255,45,85,0.4)" strokeDasharray="3 3" />
            <Tooltip
              contentStyle={{ background: '#0b0d14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#fff' }}
              formatter={(v) => formatCurrency(Number(v))}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke={goesNegative ? '#ff2d55' : '#22d3ee'}
              strokeWidth={2.5}
              fill="url(#dashForecastFill)"
              dot={false}
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </StatCard>
  )
}
