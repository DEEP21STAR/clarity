import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { convertPeriodAmount, monthlyEquivalent, nzNetIncome, auNetIncome } from '@/lib/logic'
import type { Period } from '@/lib/types'
import { cn, formatCurrency } from '@/lib/utils'

const PERIODS: Period[] = ['daily', 'weekly', 'monthly', 'quarterly', 'annual']

export function Budgets() {
  const { state } = useStore()
  const [period, setPeriod] = useState<Period>('monthly')

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Budgets</h2>
          <p className="text-sm text-white/50 mt-1">Income vs fixed bills across every period view.</p>
        </div>
        <div className="flex rounded-full border border-white/10 overflow-hidden">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium capitalize transition-all',
                period === p ? 'bg-gradient-to-r from-cyan-400 to-purple-500 text-black' : 'text-white/50 hover:text-white'
              )}
            >
              {p}
            </button>
          ))}
        </div>
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

      <StatCard label="Bill Category Breakdown" glow="purple" tilt={false}>
        <div className="mt-4 space-y-2">
          {(['housing', 'utilities', 'insurance', 'subscription', 'debt', 'other'] as const).map((cat) => {
            const total = state.bills.filter((b) => b.active && b.category === cat).reduce((s, b) => s + monthlyEquivalent(b.amount, b.frequency), 0)
            const pct = monthlyBills > 0 ? (total / monthlyBills) * 100 : 0
            if (total === 0) return null
            return (
              <div key={cat}>
                <div className="flex justify-between text-xs text-white/50 capitalize mb-1">
                  <span>{cat}</span><span>{formatCurrency(total)}</span>
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
      </StatCard>
    </div>
  )
}
