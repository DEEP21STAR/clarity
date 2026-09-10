import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { avalanchePlan } from '@/lib/logic'
import { formatCurrency } from '@/lib/utils'
import { fireBigConfetti } from '@/lib/confetti'
import { Plus, Trash2, CheckCircle2 } from 'lucide-react'
import type { Debt } from '@/lib/types'

export function Debts() {
  const { state, addDebt, removeDebt, updateDebt, markDebtPaidOff } = useStore()
  const [extraBudget, setExtraBudget] = useState(100)

  const plan = useMemo(() => avalanchePlan(state.debts, extraBudget), [state.debts, extraBudget])
  const totalBalance = state.debts.reduce((s, d) => s + d.balance, 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Debts</h2>
        <p className="text-sm text-white/50 mt-1">Avalanche payoff order — highest APR cleared first.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Debt" glow="danger">
          <div className="mt-4 text-3xl font-bold text-rose-300 tabular-nums"><CountUp value={totalBalance} prefix="$" /></div>
        </StatCard>
        <StatCard label="Months to Debt-Free" glow="amber" delay={0.05}>
          <div className="mt-4 text-3xl font-bold text-amber-300 tabular-nums"><CountUp value={plan.totalMonths} decimals={0} /></div>
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

      <StatCard label="Avalanche Order" glow="purple" tilt={false}>
        <div className="mt-4 space-y-3">
          {[...state.debts].sort((a, b) => b.apr - a.apr).map((debt, i) => {
            const entry = plan.entries.find((e) => e.debtId === debt.id)
            return (
              <div key={debt.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 text-black flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <input value={debt.name} onChange={(e) => updateDebt(debt.id, { name: e.target.value })} className="bg-transparent outline-none flex-1 min-w-[100px]" />
                <input type="number" step="0.01" value={debt.balance} onChange={(e) => updateDebt(debt.id, { balance: parseFloat(e.target.value) || 0 })} className="bg-transparent outline-none w-24 tabular-nums text-right" />
                <div className="flex items-center gap-1 w-20">
                  <input type="number" step="0.1" value={debt.apr * 100} onChange={(e) => updateDebt(debt.id, { apr: (parseFloat(e.target.value) || 0) / 100 })} className="bg-transparent outline-none w-12 tabular-nums text-right" />
                  <span className="text-white/40 text-xs">% APR</span>
                </div>
                <div className="text-xs text-white/50 w-28 text-right">
                  {entry ? `${entry.monthsToPayoff}mo · ${formatCurrency(entry.totalInterestPaid)} int.` : '—'}
                </div>
                {debt.balance > 0 && (
                  <button
                    onClick={() => { markDebtPaidOff(debt.id); fireBigConfetti() }}
                    title="Mark as paid off"
                    className="text-white/30 hover:text-emerald-400"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => removeDebt(debt.id)} className="text-white/30 hover:text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
          {state.debts.length === 0 && <p className="text-sm text-white/40">No debts tracked yet.</p>}
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
