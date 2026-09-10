import { useState } from 'react'
import { StatCard } from './StatCard'
import { useStore } from '@/lib/store'
import { suggestedFortnightlyForSinkingFund } from '@/lib/logic'
import { formatCurrency, formatNumericDate, formatShortDate, todayIso } from '@/lib/utils'
import type { SinkingFund } from '@/lib/types'
import { Plus, Trash2, X } from 'lucide-react'
import { useUndoableDelete } from '@/lib/useUndoableDelete'

/**
 * Generalised sinking funds — the SAME fortnightly-smoothing math as the
 * Gas/Electricity periodic bills, generalised to ANY irregular lump-sum
 * expense (car WOF/rego, Christmas, annual subscriptions) rather than being
 * restricted to utility-billing-cycle bills.
 */
export function SinkingFundsSection() {
  const { state, addSinkingFund, updateSinkingFund, removeSinkingFund } = useStore()
  const withUndo = useUndoableDelete()
  const [showAdd, setShowAdd] = useState(false)
  const today = todayIso()

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white/85">Sinking Funds</h3>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200">
            <Plus className="w-3 h-3" /> Add irregular expense
          </button>
        )}
      </div>
      <p className="text-xs text-white/40 mb-3">For any irregular lump-sum expense — car WOF/rego, Christmas, annual subscriptions — smoothed into fortnightly set-asides, same math as the Periodic Bills above.</p>

      {showAdd && (
        <div className="mb-4">
          <FundForm onCancel={() => setShowAdd(false)} onSave={(v) => { addSinkingFund({ id: `sinking-${Date.now()}`, ...v }); setShowAdd(false) }} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {state.sinkingFunds.map((fund) => (
          <FundCard
            key={fund.id}
            fund={fund}
            today={today}
            onUpdate={(patch) => updateSinkingFund(fund.id, patch)}
            onRemove={() => withUndo(`${fund.name} removed`, () => removeSinkingFund(fund.id))}
          />
        ))}
      </div>
    </div>
  )
}

function FundCard({ fund, today, onUpdate, onRemove }: { fund: SinkingFund; today: string; onUpdate: (patch: Partial<SinkingFund>) => void; onRemove: () => void }) {
  const suggested = suggestedFortnightlyForSinkingFund(fund, today)
  const progress = fund.targetAmount > 0 ? Math.min(100, (fund.currentSaved / fund.targetAmount) * 100) : 0
  return (
    <StatCard label={fund.name} glow="amber">
      <button onClick={onRemove} className="absolute top-3 right-3 z-20 text-white/30 hover:text-rose-400" aria-label={`Remove ${fund.name}`}>
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      <div className="mt-4 flex justify-between text-sm text-white/60">
        <span>{formatCurrency(fund.currentSaved)} of {formatCurrency(fund.targetAmount)}</span>
        <span className="text-white/40">due {formatShortDate(fund.targetDate)}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-3 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-cyan-200/80">Suggested fortnightly set-aside</span>
          <span className="text-lg font-bold tabular-nums text-cyan-300">{formatCurrency(suggested)}</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <label className="text-xs text-white/50">Saved so far</label>
        <span className="text-white/40">$</span>
        <input
          type="number" step="0.01" value={fund.currentSaved}
          onChange={(e) => onUpdate({ currentSaved: parseFloat(e.target.value) || 0 })}
          className="bg-transparent outline-none border-b border-white/10 focus:border-amber-400/50 w-20 tabular-nums text-sm"
        />
      </div>
    </StatCard>
  )
}

function FundForm({ onCancel, onSave }: { onCancel: () => void; onSave: (v: { name: string; targetAmount: number; targetDate: string; currentSaved: number }) => void }) {
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState(0)
  const [targetDate, setTargetDate] = useState('')

  return (
    <StatCard label="Add Irregular Expense" glow="amber">
      <div className="mt-4 space-y-3">
        <div className="flex justify-end">
          <button onClick={onCancel} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div>
          <label className="text-xs text-white/50">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Car WOF & Rego" className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-amber-400/50" />
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
            <label className="text-xs text-white/50">Due date</label>
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-amber-400/50" />
            {/* Real DD/MM/YYYY read-out — the native input's own digits follow the browser's
                OS/locale, not this page (confirmed live: lang="en-NZ" changes nothing there). */}
            {targetDate && <span className="block text-[10px] text-white/30 mt-1 tabular-nums">{formatNumericDate(targetDate)}</span>}
          </div>
        </div>
        <button
          onClick={() => name.trim() && targetDate && onSave({ name: name.trim(), targetAmount, targetDate, currentSaved: 0 })}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-black text-sm font-semibold hover:opacity-90"
        >
          Add fund
        </button>
      </div>
    </StatCard>
  )
}
