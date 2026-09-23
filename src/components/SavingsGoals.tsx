import { useState } from 'react'
import { StatCard } from './StatCard'
import { useStore } from '@/lib/store'
import { formatCurrency, formatShortDate } from '@/lib/utils'
import type { SavingsGoal } from '@/lib/types'
import { Plus, Trash2, PiggyBank, X, CircleDot, Rows3, Plane } from 'lucide-react'
import { useUndoableDelete } from '@/lib/useUndoableDelete'
import { fireSavingsConfetti } from '@/lib/confetti'
import { DateField } from './DateField'

/** Savings goals — target/target-date, a per-period funding amount that deducts from Live Funds Available, and a "log contribution" action that banks it. */
export function SavingsGoalsSection() {
  const { state, addSavingsGoal, updateSavingsGoal, removeSavingsGoal, logGoalContribution } = useStore()
  const withUndo = useUndoableDelete()
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
        <StatCard label="No Goals Yet" glow="purple">
          {/* 2026-09-23 round 8 — "illustrated empty states" (Deep, via the ideation table). Was
              plain hint text with no visual anchor — a real gap since this is the very first
              thing a new user (or one who's cleared their goals) sees on this section. */}
          <div className="mt-4 flex flex-col items-center text-center py-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-purple-400/20 blur-xl animate-pulse" />
              <PiggyBank className="relative w-12 h-12 text-purple-300" strokeWidth={1.5} />
            </div>
            <p className="mt-4 text-sm text-white/60 max-w-xs">
              Nothing saved yet — a house deposit, a holiday, an emergency fund. Give it a name and a target.
            </p>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="mt-4 flex items-center gap-1.5 text-sm font-semibold rounded-lg px-4 py-2 bg-gradient-to-r from-purple-400 to-pink-500 text-black hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" /> Add your first goal
            </button>
          </div>
        </StatCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {state.savingsGoals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onUpdate={(patch) => updateSavingsGoal(goal.id, patch)}
            onRemove={() => withUndo(`${goal.name} goal removed`, () => removeSavingsGoal(goal.id))}
            onLogContribution={() => { logGoalContribution(goal.id); fireSavingsConfetti() }}
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
  const [ringView, setRingView] = useState(false)
  const RADIUS = 22
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  return (
    <StatCard label={goal.name} glow="success">
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        {/* #26 — circular progress-ring as an alternate view, not a replacement for the bar. */}
        <button onClick={() => setRingView((v) => !v)} title={ringView ? 'Switch to bar view' : 'Switch to ring view'} className="text-white/30 hover:text-emerald-300">
          {ringView ? <Rows3 className="w-3.5 h-3.5" /> : <CircleDot className="w-3.5 h-3.5" />}
        </button>
        <button onClick={onRemove} className="text-white/30 hover:text-rose-400" aria-label={`Remove ${goal.name}`}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="mt-4 flex items-center gap-3">
        {ringView ? (
          <div className="relative shrink-0" style={{ width: 56, height: 56 }}>
            <svg width={56} height={56} viewBox="0 0 56 56" className="-rotate-90">
              <circle cx={28} cy={28} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
              <circle
                cx={28} cy={28} r={RADIUS} fill="none" stroke="url(#goalRingGradient)" strokeWidth={5} strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - progress / 100)}
                style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)' }}
              />
              <defs>
                <linearGradient id="goalRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white">{progress.toFixed(0)}%</div>
          </div>
        ) : goal.category === 'holiday' ? (
          <Plane className="w-6 h-6 text-cyan-300 shrink-0" />
        ) : (
          <PiggyBank className="w-6 h-6 text-emerald-300 shrink-0" />
        )}
        <div className="flex-1">
          <div className="flex justify-between text-sm">
            <span className="text-white/60">{formatCurrency(goal.contributedAmount)} of {formatCurrency(goal.targetAmount)}</span>
            <span className="text-white/40">{progress.toFixed(0)}%</span>
          </div>
          {!ringView && (
            <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${progress}%`, transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)' }} />
            </div>
          )}
        </div>
      </div>
      {goal.targetDate && <p className="mt-2 text-xs text-white/40">Target date: {formatShortDate(goal.targetDate)}</p>}
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

function GoalForm({ onCancel, onSave }: { onCancel: () => void; onSave: (v: { name: string; targetAmount: number; targetDate?: string; fundedThisPeriod: number; category?: 'holiday' }) => void }) {
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState(0)
  const [targetDate, setTargetDate] = useState('')
  const [fundedThisPeriod, setFundedThisPeriod] = useState(0)
  const [isHoliday, setIsHoliday] = useState(false)

  // tilt off: 4-field form — rotating under the cursor mid-type is a real regression.
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
        <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer w-fit">
          <input type="checkbox" checked={isHoliday} onChange={(e) => setIsHoliday(e.target.checked)} className="accent-cyan-400 w-3.5 h-3.5" />
          <Plane className="w-3.5 h-3.5 text-cyan-300" /> This is a holiday savings goal
        </label>
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
            <DateField
              value={targetDate}
              onChange={setTargetDate}
              wrapperClassName="mt-1"
              inputClassName="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-emerald-400/50"
              overlayClassName="px-3"
              placeholder="optional"
            />
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
          onClick={() => name.trim() && onSave({ name: name.trim(), targetAmount, targetDate: targetDate || undefined, fundedThisPeriod, category: isHoliday ? 'holiday' : undefined })}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-400 text-black text-sm font-semibold hover:opacity-90"
        >
          Add goal
        </button>
      </div>
    </StatCard>
  )
}
