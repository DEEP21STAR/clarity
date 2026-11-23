import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceDot } from 'recharts'
import { StatCard } from './StatCard'
import { useStore } from '@/lib/store'
import { projectBalanceSeries, recurringBillsDueOnDate, incomeOnDate } from '@/lib/logic'
import { formatCurrency, formatShortDate, todayIso } from '@/lib/utils'

const PAYDAY_COLOR = '#34d399'
const BILL_COLOR = '#fbbf24'
const BOTH_COLOR = '#c084fc'

interface ForecastEvent { date: string; balance: number; payday: number; bills: { name: string; amount: number }[] }

const compactMoney = (v: number) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`)

function ChartTooltip({ active, label, payload, events }: { active?: boolean; label?: string; payload?: { value?: number }[]; events: Map<string, ForecastEvent> }) {
  if (!active || !payload?.length || !label) return null
  const ev = events.get(label)
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b0d14] px-3 py-2 text-xs shadow-lg max-w-[220px]">
      <p className="font-semibold text-white">{formatShortDate(label)}</p>
      <p className="text-white/70">Projected <span className="text-white font-medium">{formatCurrency(Number(payload[0].value))}</span></p>
      {ev && ev.payday > 0 && <p style={{ color: PAYDAY_COLOR }}>Payday +{formatCurrency(ev.payday)}</p>}
      {ev?.bills.map((b, i) => <p key={i} style={{ color: BILL_COLOR }} className="truncate">{b.name} -{formatCurrency(b.amount)}</p>)}
    </div>
  )
}

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
    // Real bug fix (round 8) — this was silently using the hardcoded default income anchor
    // instead of this account's own state.incomeAnchor. See projectBalanceSeries's doc comment.
    () => projectBalanceSeries(startBalance, today, horizon, state.bills, state.periodicBills, state.oneOffEntries, state.incomeAnchor),
    [startBalance, today, horizon, state.bills, state.periodicBills, state.oneOffEntries, state.incomeAnchor]
  )

  const chartData = series.map((p) => ({ date: p.date, balance: p.balance }))
  // Forecast markers use the same rules the projection above walks (income anchor + bill due days) — no separate data.
  const events = useMemo(() => {
    const m = new Map<string, ForecastEvent>()
    for (const p of series) {
      const payday = incomeOnDate(p.date, state.incomeAnchor)
      const bills = recurringBillsDueOnDate(state.bills, p.date).map((b) => ({ name: b.name, amount: b.amount }))
      if (payday > 0 || bills.length > 0) m.set(p.date, { date: p.date, balance: p.balance, payday, bills })
    }
    return m
  }, [series, state.bills, state.incomeAnchor])
  const lowestPoint = Math.min(...series.map((p) => p.balance))

  return (
    <StatCard label="Cash-Flow Forecast" glow={lowestPoint < 0 ? 'danger' : 'cyan'}>
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

      <div className="mt-4" style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="rgba(255,255,255,0.5)"
              fontSize={12}
              tickLine={false}
              minTickGap={28}
              padding={{ left: 14, right: 4 }}
              tickFormatter={(v) => formatShortDate(String(v))}
            />
            <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} width={48} tickFormatter={(v) => compactMoney(Number(v))} />
            <ReferenceLine y={0} stroke="rgba(255,45,85,0.5)" strokeDasharray="4 4" />
            <ReferenceLine x={today} stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} />
            <ReferenceDot x={today} y={chartData[0].balance} r={6} fill="none" stroke="#fff" strokeWidth={2} ifOverflow="visible" label={{ value: 'Today', position: 'bottom', fill: '#fff', fontSize: 12, fontWeight: 600 }} />
            <Tooltip content={<ChartTooltip events={events} />} cursor={{ stroke: 'rgba(255,255,255,0.25)' }} />
            <Line type="monotone" dataKey="balance" stroke={lowestPoint < 0 ? '#ff2d55' : '#22d3ee'} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
            {[...events.values()].map((e) => (
              <ReferenceDot
                key={e.date}
                x={e.date}
                y={e.balance}
                r={3.5}
                fill={e.payday > 0 && e.bills.length > 0 ? BOTH_COLOR : e.payday > 0 ? PAYDAY_COLOR : BILL_COLOR}
                stroke="#0b0d14"
                strokeWidth={1}
                ifOverflow="visible"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/65" aria-label="Chart legend">
        <li className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 bg-white/80" />Today</li>
        <li className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: PAYDAY_COLOR }} />Payday</li>
        <li className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: BILL_COLOR }} />Bill due</li>
        <li className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: BOTH_COLOR }} />Both</li>
        <li className="flex items-center gap-1.5"><span className="inline-block w-4 border-t border-dashed border-rose-400" />$0</li>
      </ul>
      {lowestPoint < 0 && (
        <p className="mt-2 text-xs text-rose-300">⚠ Projected to go negative within this window — lowest point {formatCurrency(lowestPoint)}.</p>
      )}
    </StatCard>
  )
}
