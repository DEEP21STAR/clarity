import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { avalanchePlan, avalanchePayoffTimeline, categoryColor, addDaysIso, creditCardsAsDebts, round2 } from '@/lib/logic'
import { cn, formatCurrency, formatLongDate, todayIso } from '@/lib/utils'
import { fireBigConfetti } from '@/lib/confetti'
import { Plus, Trash2, CheckCircle2, PartyPopper, Link2 } from 'lucide-react'
import type { Debt } from '@/lib/types'
import { useUndoableDelete } from '@/lib/useUndoableDelete'
import { RadialProgress } from './RadialProgress'

/** Round 21, item #12 — months-to-debt-free is abstract on its own; this turns it into a real calendar date with a year, so a multi-year payoff plan doesn't silently lose track of which year it lands in. */
function monthsToCalendarDate(months: number, fromIso: string): string {
  const days = Math.round(months * (365.25 / 12))
  return formatLongDate(addDaysIso(fromIso, days))
}

export function Debts() {
  const { state, addDebt, removeDebt, updateDebt, markDebtPaidOff } = useStore()
  const withUndo = useUndoableDelete()
  const [extraBudget, setExtraBudget] = useState(100)

  // Coordinator follow-up, real architectural gap Deep found: this tab's Total Debt/avalanche
  // math only ever knew about state.debts (manually-entered debts) — GEM VISA card balances,
  // real debt with a real tracked APR, lived entirely in a separate data model and were
  // invisible here. creditCardsAsDebts() maps every card with a real balance into the SAME
  // Debt shape, using its real purchase APR, so it flows through the identical avalanche math
  // as a manual entry — the automatic case is now actually automatic, not a second system.
  const cardDebts = useMemo(() => creditCardsAsDebts(state.creditCards), [state.creditCards])
  const cardDebtIds = useMemo(() => new Set(cardDebts.map((d) => d.id)), [cardDebts])
  const combinedDebts = useMemo(() => [...cardDebts, ...state.debts], [cardDebts, state.debts])

  const plan = useMemo(() => avalanchePlan(combinedDebts, extraBudget), [combinedDebts, extraBudget])
  const timeline = useMemo(() => avalanchePayoffTimeline(combinedDebts, extraBudget), [combinedDebts, extraBudget])
  const totalBalance = combinedDebts.reduce((s, d) => s + d.balance, 0)
  const activeDebts = combinedDebts.filter((d) => d.balance > 0)

  // #6/#7 — real avalanche payoff timeline (total balance falling to $0) plus a
  // per-debt "snowball" series (each debt's own line dropping to zero, in the
  // real avalanche order) from the exact same month-by-month simulation.
  const chartData = useMemo(
    () => timeline.map((pt) => ({ month: pt.month, Total: pt.totalBalance, ...pt.balances })),
    [timeline]
  )

  // Coordinator follow-up — a single "big picture" ring: real cumulative payments recorded
  // against credit cards/installment plans (a genuine, real number from paymentRecords) vs.
  // what's still owed today across everything combined. Honest scoping, disclosed in the
  // caption below: manually-entered debts (car loan etc.) have no payment LOG in this app —
  // only a current balance — so they can only ever appear on the "still owed" side of this
  // particular ring, never the "paid" side, until this app grows a payment log for them too.
  const totalPaidAllTime = useMemo(
    () => round2(state.paymentRecords.filter((r) => r.targetType === 'creditCard' || r.targetType === 'installmentPlan').reduce((s, r) => s + r.amount, 0)),
    [state.paymentRecords]
  )
  const payoffDenominator = totalPaidAllTime + totalBalance
  const payoffPercent = payoffDenominator > 0 ? (totalPaidAllTime / payoffDenominator) * 100 : 0
  return (
    <div className="space-y-6">
      <div>
        <h2 className="gradient-heading text-2xl font-bold tracking-tight">Debts</h2>
        <p className="text-sm text-white/50 mt-1">Avalanche payoff order — highest APR cleared first.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Debt" glow="danger">
          <div className="mt-4 text-3xl font-bold text-rose-300 tabular-nums"><CountUp value={totalBalance} prefix="$" /></div>
        </StatCard>
        <StatCard label="Months to Debt-Free" glow="amber" delay={0.05}>
          <div className="mt-4 text-3xl font-bold text-amber-300 tabular-nums"><CountUp value={plan.totalMonths} decimals={0} /></div>
          {plan.totalMonths > 0 && activeDebts.length > 0 && (
            <p className="text-xs text-white/40 mt-2">≈ {monthsToCalendarDate(plan.totalMonths, todayIso())} at this pace.</p>
          )}
        </StatCard>
        <StatCard label="Extra Monthly Budget" glow="cyan" delay={0.1}>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-white/40">$</span>
            <input
              type="number"
              value={extraBudget}
              onChange={(e) => setExtraBudget(parseFloat(e.target.value) || 0)}
              className="bg-transparent text-2xl font-bold tabular-nums text-cyan-200 outline-none border-b border-white/10 focus:border-cyan-400/60 w-full"
            />
          </div>
          <p className="text-xs text-white/40 mt-2">Thrown at the highest-APR debt each month.</p>
        </StatCard>
      </div>

      {/* Coordinator follow-up — the "big picture" ring. See the totalPaidAllTime comment
          above for exactly what's counted on each side; disclosed here too so it's never
          read as more complete than it really is. */}
      {payoffDenominator > 0 && (
        <StatCard label="Overall Debt Payoff" glow="danger" delay={0.15} tooltip="Real cumulative card/plan payments recorded in this app vs. what's still owed today, combined across every debt. Manually-entered debts without a payment log (e.g. a car loan) only ever count toward 'still owed', never 'paid' — see the caption below.">
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <RadialProgress
              percent={payoffPercent}
              color={payoffPercent >= 66 ? '#34d399' : payoffPercent >= 33 ? '#f59e0b' : '#fb7185'}
              size={140}
              strokeWidth={12}
              centerLabel={
                <>
                  <span className="text-2xl font-black tabular-nums text-white">{Math.round(payoffPercent)}%</span>
                  <span className="text-[10px] text-white/40 uppercase tracking-wide">paid</span>
                </>
              }
            />
            <div className="flex-1 min-w-[180px] space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Paid all-time (recorded)</span>
                <span className="font-bold tabular-nums text-emerald-300">{formatCurrency(totalPaidAllTime)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Still owed today</span>
                <span className="font-bold tabular-nums text-rose-300">{formatCurrency(totalBalance)}</span>
              </div>
              <p className="text-[10px] text-white/30 pt-1 border-t border-white/10">
                Counts real payments recorded against credit cards/installment plans. Manually-entered debts without a payment log only count toward what's still owed.
              </p>
            </div>
          </div>
        </StatCard>
      )}

      {timeline.length > 1 && (
        <StatCard label="Payoff Timeline" glow="danger">
          <p className="mt-4 text-xs text-white/40">
            Real avalanche simulation — total balance falling to $0, plus each debt's own "snowball" line dropping out one at a time as it clears (highest APR first).
          </p>
          <div className="mt-3" style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} label={{ value: 'months', position: 'insideBottomRight', fill: 'rgba(255,255,255,0.3)', fontSize: 10, offset: -2 }} />
                <YAxis stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                <Tooltip
                  contentStyle={{ background: '#0b0d14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                  labelFormatter={(m) => `Month ${m}`}
                  formatter={(v) => formatCurrency(Number(v))}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Total" stroke="#ff2d55" strokeWidth={2.5} dot={false} />
                {activeDebts.map((d) => (
                  <Line key={d.id} type="monotone" dataKey={d.id} name={d.name} stroke={categoryColor(d.name)} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </StatCard>
      )}

      {/* tilt off: dense per-row editable inputs — kept from the app-wide mouse-tilt audit. */}
      <StatCard
        label="Avalanche Order"
        glow="purple"
        tilt={false}
        tooltip="GEM VISA card balances (with a Link icon) are synced automatically from their real balance/APR on Upcoming Payments — edit them there, not here. Everything else is a manually-entered debt."
      >
        <div className="mt-4 space-y-3">
          {[...combinedDebts].sort((a, b) => b.apr - a.apr).map((debt, i) => {
            const entry = plan.entries.find((e) => e.debtId === debt.id)
            const isCardDebt = cardDebtIds.has(debt.id)
            return (
              <div key={debt.id} className={cn('flex items-center gap-3 rounded-xl border p-3', isCardDebt ? 'border-cyan-400/20 bg-cyan-500/5' : 'border-white/10 bg-black/30')}>
                <div className="w-7 h-7 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 text-black flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                {isCardDebt ? (
                  <span className="flex-1 min-w-[100px] flex items-center gap-1.5 text-white/85" title="Synced automatically from this card's real balance on Upcoming Payments — not editable here.">
                    <Link2 className="w-3 h-3 text-cyan-400 shrink-0" /> {debt.name}
                  </span>
                ) : (
                  <input value={debt.name} onChange={(e) => updateDebt(debt.id, { name: e.target.value })} className="bg-transparent outline-none flex-1 min-w-[100px]" />
                )}
                {isCardDebt ? (
                  <span className="w-24 tabular-nums text-right text-white/85">{formatCurrency(debt.balance)}</span>
                ) : (
                  <input type="number" step="0.01" value={debt.balance} onChange={(e) => updateDebt(debt.id, { balance: parseFloat(e.target.value) || 0 })} className="bg-transparent outline-none w-24 tabular-nums text-right" />
                )}
                <div className="flex items-center gap-1 w-20 justify-end">
                  {isCardDebt ? (
                    <span className="tabular-nums text-white/85">{(debt.apr * 100).toFixed(2)}</span>
                  ) : (
                    <input type="number" step="0.1" value={debt.apr * 100} onChange={(e) => updateDebt(debt.id, { apr: (parseFloat(e.target.value) || 0) / 100 })} className="bg-transparent outline-none w-12 tabular-nums text-right" />
                  )}
                  <span className="text-white/40 text-xs">% APR</span>
                </div>
                <div className="text-xs text-white/50 w-28 text-right">
                  {entry ? `${entry.monthsToPayoff}mo · ${formatCurrency(entry.totalInterestPaid)} int.` : '—'}
                </div>
                {!isCardDebt && debt.balance > 0 && (
                  <button
                    onClick={() => { markDebtPaidOff(debt.id); fireBigConfetti() }}
                    title="Mark as paid off"
                    className="text-white/30 hover:text-emerald-400"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
                {isCardDebt ? (
                  <span className="w-4 h-4 shrink-0" /> // keeps row heights/alignment identical to editable rows, no dead-end trash icon on a synced row
                ) : (
                  <button onClick={() => withUndo(`${debt.name} removed`, () => removeDebt(debt.id))} className="text-white/30 hover:text-rose-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
          {combinedDebts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 border border-emerald-400/30 flex items-center justify-center mb-3">
                <PartyPopper className="w-7 h-7 text-emerald-300" />
              </div>
              <p className="text-white/70 font-medium">No debts tracked — genuinely nothing to pay off here.</p>
              <p className="text-xs text-white/40 mt-1 max-w-xs">Add one below if that changes. GEM VISA balances appear here automatically once a card carries one.</p>
            </div>
          )}
          <button
            onClick={() => addDebt({ id: `debt-${Date.now()}`, name: 'New debt', balance: 0, apr: 0.19, minPayment: 25 } as Debt)}
            className="flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
          >
            <Plus className="w-3 h-3" /> Add debt
          </button>
        </div>
      </StatCard>
    </div>
  )
}
