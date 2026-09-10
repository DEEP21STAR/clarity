import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { StatCard } from './StatCard'
import { useStore } from '@/lib/store'
import { projectBalanceSeries } from '@/lib/logic'
import { formatCurrency, todayIso } from '@/lib/utils'

/** Rolling 30/90-day projected balance line — real payday engine + all bills (incl. periodic/smoothed) + one-off entries, walked day by day. */
export function CashFlowChart() {
  const { state } = useStore()
  const [horizon, setHorizon] = useState<30 | 90>(30)
  const today = todayIso()

  const startBalance = useMemo(
    () => state.accounts.filter((a) => a.countsTowardLiveFunds).reduce((s, a) => s + a.value, 0),
    [state.accounts]
  )

  const series = useMemo(
    () => projectBalanceSeries(startBalance, today, horizon, state.bills, state.periodicBills, state.oneOffEntries),
    [startBalance, today, horizon, state.bills, state.periodicBills, state.oneOffEntries]
  )

  const chartData = series.map((p) => ({ date: p.date.slice(5), balance: p.balance }))
  const lowestPoint = Math.min(...series.map((p) => p.balance))

  return (
    <StatCard label="Cash-Flow Forecast" glow={lowestPoint < 0 ? 'danger' : 'cyan'} tilt={false}>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-white/40">Projected balance from HSBC + Overdraft, walking forward real paydays and bills.</p>
        <div className="flex rounded-full border border-white/10 overflow-hidden">
          {[30, 90].map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h as 30 | 90)}
              className={`px-3 py-1 text-xs font-medium ${horizon === h ? 'bg-gradient-to-r from-cyan-400 to-purple-500 text-black' : 'text-white/50 hover:text-white'}`}
            >
              {h}d
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4" style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="date" stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} interval={Math.floor(horizon / 6)} />
            <YAxis stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
            <ReferenceLine y={0} stroke="rgba(255,45,85,0.5)" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{ background: '#0b0d14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
              labelStyle={{ color: '#fff' }}
              formatter={(v) => formatCurrency(Number(v))}
            />
            <Line type="monotone" dataKey="balance" stroke={lowestPoint < 0 ? '#ff2d55' : '#22d3ee'} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {lowestPoint < 0 && (
        <p className="mt-2 text-xs text-rose-300">⚠ Projected to go negative within this window — lowest point {formatCurrency(lowestPoint)}.</p>
      )}
    </StatCard>
  )
}
