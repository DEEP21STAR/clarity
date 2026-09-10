import { useState } from 'react'
import { StatCard } from './StatCard'
import { useStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import type { SavingsGoal } from '@/lib/types'
import { Plus, Trash2, PiggyBank, X } from 'lucide-react'

/** Savings goals — target/target-date, a per-period funding amount that deducts from Live Funds Available, and a "log contribution" action that banks it. */
export function SavingsGoalsSection() {
  const { state, addSavingsGoal, updateSavingsGoal, removeSavingsGoal, logGoalContribution } = useStore()
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white/85">Savings Goals</h3>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200">
            <Plus className="w-3 h-3" /> Add goal
          </button>
        )}
      </div>

      {showAdd && (
        <div className="mb-4">
          <GoalForm
            onCancel={() => setShowAdd(false)}
            onSave={(v) => {
              addSavingsGoal({ id: `goal-${Date.now()}`, contributedAmount: 0, ...v })
              setShowAdd(false)
            }}
          />
        </div>
      )}

      {state.savingsGoals.length === 0 && !showAdd && (
        <StatCard label="No Goals Yet" glow="purple" tilt={false}>
          <p className="mt-4 text-sm text-white/40">Add a savings goal to start tracking progress toward something specific.</p>
        </StatCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {state.savingsGoals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onUpdate={(patch) => updateSavingsGoal(goal.id, patch)}
            onRemove={() => removeSavingsGoal(goal.id)}
            onLogContribution={() => logGoalContribution(goal.id)}
          />
        ))}
      </div>
    </div>
  )
}

function GoalCard({ goal, onUpdate, onRemove, onLogContribution }: {
  goal: SavingsGoal
  onUpdate: (patch: Partial<SavingsGoal>) => void
  onRemove: () => void
  onLogContribution: () => void
}) {
  const progress = goal.targetAmount > 0 ? Math.min(100, (goal.contributedAmount / goal.targetAmount) * 100) : 0
  return (
    <StatCard label={goal.name} glow="success" tilt={false}>
      <button onClick={onRemove} className="absolute top-3 right-3 z-20 text-white/30 hover:text-rose-400" aria-label={`Remove ${goal.name}`}>
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      <div className="mt-4 flex items-center gap-3">
        <PiggyBank className="w-6 h-6 text-emerald-300 shrink-0" />
        <div className="flex-1">
          <div className="flex justify-between text-sm">
            <span className="text-white/60">{formatCurrency(goal.contributedAmount)} of {formatCurrency(goal.targetAmount)}</span>
            <span className="text-white/40">{progress.toFixed(0)}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
      {goal.targetDate && <p className="mt-2 text-xs text-white/40">Target date: {goal.targetDate}</p>}
      <div className="mt-3 flex items-center gap-2">
        <label className="text-xs text-white/50">Funded this period</label>
        <span className="text-white/40">$</span>
        <input
          type="number"
          step="0.01"
          value={goal.fundedThisPeriod}
          onChange={(e) => onUpdate({ fundedThisPeriod: parseFloat(e.target.value) || 0 })}
          className="bg-transparent outline-none border-b border-white/10 focus:border-emerald-400/50 w-20 tabular-nums text-sm"
        />
      </div>
      <button
        onClick={onLogContribution}
        disabled={goal.fundedThisPeriod <= 0}
        className="mt-3 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-400 text-black text-xs font-semibold hover:opacity-90 disabled:opacity-30"
      >
        Log this period's {formatCurrency(goal.fundedThisPeriod)} contribution
      </button>
    </StatCard>
  )
}

function GoalForm({ onCancel, onSave }: { onCancel: () => void; onSave: (v: { name: string; targetAmount: number; targetDate?: string; fundedThisPeriod: number }) => void }) {
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState(0)
  const [targetDate, setTargetDate] = useState('')
  const [fundedThisPeriod, setFundedThisPeriod] = useState(0)

  return (
    <StatCard label="Add Savings Goal" glow="success" tilt={false}>
      <div className="mt-4 space-y-3">
        <div className="flex justify-end">
          <button onClick={onCancel} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div>
          <label className="text-xs text-white/50">Goal name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Christmas" className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-emerald-400/50" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/50">Target amount</label>
            <div className="mt-1 flex items-center gap-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2">
              <span className="text-white/40">$</span>
              <input type="number" step="0.01" value={targetAmount} onChange={(e) => setTargetAmount(parseFloat(e.target.value) || 0)} className="w-full bg-transparent outline-none tabular-nums" />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50">Target date (optional)</label>
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-emerald-400/50" />
          </div>
        </div>
        <div>
          <label className="text-xs text-white/50">Funded this period</label>
          <div className="mt-1 flex items-center gap-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2">
            <span className="text-white/40">$</span>
            <input type="number" step="0.01" value={fundedThisPeriod} onChange={(e) => setFundedThisPeriod(parseFloat(e.target.value) || 0)} className="w-full bg-transparent outline-none tabular-nums" />
          </div>
        </div>
        <button
          onClick={() => name.trim() && onSave({ name: name.trim(), targetAmount, targetDate: targetDate || undefined, fundedThisPeriod })}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-400 text-black text-sm font-semibold hover:opacity-90"
        >
          Add goal
        </button>
      </div>
    </StatCard>
  )
}
