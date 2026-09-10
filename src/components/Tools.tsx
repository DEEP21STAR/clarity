import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { DataExportPanel } from './DataExportPanel'
import { PaymentHistoryPanel } from './PaymentHistoryPanel'
import { SegmentedControl } from './SegmentedControl'
import { calcWfhFixedRate, gstOnExclusive, gstFromInclusive, NZ_WFH_FIXED_RATE_PER_HOUR, AU_WFH_FIXED_RATE_PER_HOUR, calcRoundUpSavings, runDataHealthCheck } from '@/lib/logic'
import { formatCurrency, formatShortDate, formatNumericDate, todayIso } from '@/lib/utils'
import { Plus, Trash2, Volume2, VolumeX, AlertTriangle, Info, ShieldCheck } from 'lucide-react'
import { useUndoableDelete } from '@/lib/useUndoableDelete'

export function Tools() {
  const { state, addOneOffEntry, removeOneOffEntry, setSoundEnabled } = useStore()
  const withUndo = useUndoableDelete()
  const [hoursPerWeek, setHoursPerWeek] = useState(15)
  const [weeksPerYear, setWeeksPerYear] = useState(48)
  const [gstDirection, setGstDirection] = useState<'ex' | 'inc'>('ex')
  const [gstAmount, setGstAmount] = useState(100)
  const [roundTo, setRoundTo] = useState(5)
  const [oneOffDesc, setOneOffDesc] = useState('')
  const [oneOffAmount, setOneOffAmount] = useState(0)
  const [oneOffDate, setOneOffDate] = useState(todayIso())
  const [extraUsageDesc, setExtraUsageDesc] = useState('')
  const [extraUsageAmount, setExtraUsageAmount] = useState(0)
  const [extraUsageDate, setExtraUsageDate] = useState(todayIso())

  const roundUpSavings = useMemo(() => calcRoundUpSavings(state.transactions, roundTo), [state.transactions, roundTo])

  const rate = state.country === 'NZ' ? NZ_WFH_FIXED_RATE_PER_HOUR : AU_WFH_FIXED_RATE_PER_HOUR
  const wfhDeduction = useMemo(() => calcWfhFixedRate(hoursPerWeek, weeksPerYear, rate), [hoursPerWeek, weeksPerYear, rate])

  const gstResult = useMemo(
    () => (gstDirection === 'ex' ? gstOnExclusive(gstAmount, state.country) : gstFromInclusive(gstAmount, state.country)),
    [gstDirection, gstAmount, state.country]
  )

  // Round 21, items #10/#11 — real data-integrity self-check, recomputed live from the actual
  // current state (no manual "run" step needed — same always-fresh philosophy as every other
  // card in this app). See runDataHealthCheck()'s doc comment in logic.ts for exactly what
  // each finding category checks and why.
  const healthFindings = useMemo(
    () => runDataHealthCheck({ bills: state.bills, creditCards: state.creditCards, accounts: state.accounts }),
    [state.bills, state.creditCards, state.accounts]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="gradient-heading text-2xl font-bold tracking-tight">Tools</h2>
          <p className="text-sm text-white/50 mt-1">Home-office deduction and GST calculators.</p>
        </div>
        {/* #38 — real sound design toggle, OFF by default. */}
        <button
          onClick={() => setSoundEnabled(!state.soundEnabled)}
          title={state.soundEnabled ? 'Sound effects on — click to mute' : 'Sound effects off — click to enable chimes on bill-paid / streak milestones'}
          className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 border transition-colors ${state.soundEnabled ? 'text-cyan-300 border-cyan-400/40 bg-cyan-400/10' : 'text-white/40 border-white/10 hover:border-white/20'}`}
        >
          {state.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          Sound {state.soundEnabled ? 'on' : 'off'}
        </button>
      </div>

      <StatCard label="Home Office / WFH Deduction" glow="cyan">
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/50">Hours worked from home / week</label>
            <input type="number" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(parseFloat(e.target.value) || 0)} className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-cyan-400/50" />
          </div>
          <div>
            <label className="text-xs text-white/50">Weeks / year</label>
            <input type="number" value={weeksPerYear} onChange={(e) => setWeeksPerYear(parseFloat(e.target.value) || 0)} className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-cyan-400/50" />
          </div>
        </div>
        <div className="mt-4 text-sm text-white/50">
          Fixed rate: {formatCurrency(rate)}/hr ({state.country === 'NZ' ? 'IRD' : 'ATO'} method)
        </div>
        {/* #10 — real animated result reveal, re-triggered every recalculation (keyed on the actual result) */}
        <div key={wfhDeduction} className="result-reveal">
          <div className="mt-2 text-3xl font-bold text-cyan-300 tabular-nums"><CountUp value={wfhDeduction} prefix="$" /></div>
          <p className="text-xs text-white/40 mt-1">Estimated annual deduction — editable rate/inputs, not a lodged claim.</p>
        </div>
      </StatCard>

      <StatCard label="GST Calculator" glow="purple">
        <div className="mt-4">
          <SegmentedControl
            value={gstDirection}
            onChange={setGstDirection}
            options={[{ value: 'ex', label: 'Ex-GST → Inc-GST' }, { value: 'inc', label: 'Inc-GST → Ex-GST' }]}
          />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-white/40">$</span>
          <input type="number" value={gstAmount} onChange={(e) => setGstAmount(parseFloat(e.target.value) || 0)} className="bg-transparent text-2xl font-bold tabular-nums text-purple-200 outline-none border-b border-white/10 focus:border-purple-400/60 w-full" />
        </div>
        <div key={gstResult.gst} className="result-reveal mt-4 grid grid-cols-3 gap-4 text-sm">
          <Metric label="Ex-GST" value={gstResult.amountExGst} />
          <Metric label="GST" value={gstResult.gst} />
          <Metric label="Inc-GST" value={gstResult.amountIncGst} />
        </div>
        <p className="text-xs text-white/40 mt-3">{state.country} GST rate: {state.country === 'NZ' ? '15%' : '10%'}.</p>
      </StatCard>

      <StatCard label="Round-Up Savings Simulator" glow="amber">
        <p className="mt-4 text-xs text-amber-300/80 font-semibold uppercase tracking-wide">Simulation only — moves no real money</p>
        <div className="mt-2 flex items-center gap-2 text-sm text-white/50">
          Round every purchase up to the nearest
          <select value={roundTo} onChange={(e) => setRoundTo(Number(e.target.value))} className="bg-black/40 rounded px-2 py-1 text-xs outline-none border border-white/10">
            {[1, 2, 5, 10].map((r) => <option key={r} value={r}>${r}</option>)}
          </select>
        </div>
        <div key={roundUpSavings} className="result-reveal">
          <div className="mt-2 text-3xl font-bold text-amber-300 tabular-nums"><CountUp value={roundUpSavings} prefix="$" /></div>
          <p className="text-xs text-white/40 mt-1">You'd have "saved" this much across all imported transactions, if every purchase rounded up.</p>
        </div>
      </StatCard>

      <StatCard label="One-Off Entries" glow="cyan">
        <p className="mt-4 text-xs text-white/40">One-off income/expenses feed the Cash-Flow Forecast chart on Upcoming Payments — a bonus, a big purchase, anything outside the regular bill/pay cycle.</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
          <input value={oneOffDesc} onChange={(e) => setOneOffDesc(e.target.value)} placeholder="Description" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-400/50 md:col-span-2" />
          <div>
            <input type="date" value={oneOffDate} onChange={(e) => setOneOffDate(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-400/50" />
            {/* Real DD/MM/YYYY read-out — the native input's own digits follow the browser's
                OS/locale, not this page (confirmed live: lang="en-NZ" changes nothing there). */}
            {oneOffDate && <span className="block text-[10px] text-white/30 mt-1 tabular-nums">{formatNumericDate(oneOffDate)}</span>}
          </div>
          <div className="flex items-center gap-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2">
            <span className="text-white/40">$</span>
            <input type="number" step="0.01" value={oneOffAmount} onChange={(e) => setOneOffAmount(parseFloat(e.target.value) || 0)} className="w-full bg-transparent outline-none tabular-nums text-sm" placeholder="+income / -expense" />
          </div>
        </div>
        <button
          onClick={() => {
            if (!oneOffDesc.trim() || oneOffAmount === 0) return
            addOneOffEntry({ id: `oneoff-${Date.now()}`, date: oneOffDate, description: oneOffDesc.trim(), amount: oneOffAmount })
            setOneOffDesc(''); setOneOffAmount(0)
          }}
          className="mt-2 flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
        >
          <Plus className="w-3 h-3" /> Add entry
        </button>
        <div className="mt-3 space-y-1">
          {state.oneOffEntries.filter((e) => e.category !== 'extraUsage').map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm border-t border-white/5 pt-1.5">
              <span className="text-white/60">{formatShortDate(e.date)} — {e.description}</span>
              <div className="flex items-center gap-2">
                <span className={`tabular-nums ${e.amount < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{formatCurrency(e.amount)}</span>
                <button onClick={() => withUndo(`"${e.description}" removed`, () => removeOneOffEntry(e.id))} className="text-white/30 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </StatCard>

      <StatCard label="Extra Usage Purchases" glow="amber" tooltip="A freely-editable log for ad-hoc extra usage purchases (e.g. Claude API overage) — not a fixed recurring bill. Feeds the same Cash-Flow Forecast as any other one-off expense.">
        <p className="mt-4 text-xs text-white/40">Log any one-off extra-usage purchase as it happens — API overage, an extra credit top-up, anything outside your fixed subscriptions.</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
          <input value={extraUsageDesc} onChange={(e) => setExtraUsageDesc(e.target.value)} placeholder="e.g. Claude API overage" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400/50 md:col-span-2" />
          <div>
            <input type="date" value={extraUsageDate} onChange={(e) => setExtraUsageDate(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400/50" />
            {extraUsageDate && <span className="block text-[10px] text-white/30 mt-1 tabular-nums">{formatNumericDate(extraUsageDate)}</span>}
          </div>
          <div className="flex items-center gap-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2">
            <span className="text-white/40">$</span>
            <input type="number" step="0.01" value={extraUsageAmount} onChange={(e) => setExtraUsageAmount(parseFloat(e.target.value) || 0)} className="w-full bg-transparent outline-none tabular-nums text-sm" placeholder="amount" />
          </div>
        </div>
        <button
          onClick={() => {
            if (!extraUsageDesc.trim() || extraUsageAmount === 0) return
            addOneOffEntry({ id: `extra-usage-${Date.now()}`, date: extraUsageDate, description: extraUsageDesc.trim(), amount: -Math.abs(extraUsageAmount), category: 'extraUsage' })
            setExtraUsageDesc(''); setExtraUsageAmount(0)
          }}
          className="mt-2 flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200"
        >
          <Plus className="w-3 h-3" /> Log extra usage purchase
        </button>
        <div className="mt-3 space-y-1">
          {state.oneOffEntries.filter((e) => e.category === 'extraUsage').map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm border-t border-white/5 pt-1.5">
              <span className="text-white/60">{formatShortDate(e.date)} — {e.description}</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-rose-300">{formatCurrency(e.amount)}</span>
                <button onClick={() => withUndo(`"${e.description}" removed`, () => removeOneOffEntry(e.id))} className="text-white/30 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
          {state.oneOffEntries.filter((e) => e.category === 'extraUsage').length === 0 && (
            <p className="text-xs text-white/30 pt-1">No extra usage purchases logged yet.</p>
          )}
        </div>
      </StatCard>

      <PaymentHistoryPanel />

      {/* Round 21, items #10/#11 — real data-integrity self-check: likely duplicate
          subscriptions, active $0 bills, over-limit cards, and unexpected negative balances.
          Plain data-consistency facts, not a financial-health opinion (that's Dashboard
          Insights) — genuinely different question, genuinely different card. */}
      <StatCard
        label="Data Health Check"
        glow={healthFindings.some((f) => f.severity === 'warning') ? 'amber' : 'success'}
        tooltip="Checks for likely duplicate bills, active bills stuck at $0, card balances over their own stated limit, and unexpected negative balances — real data-consistency facts, not a financial opinion."
      >
        <div className="mt-4 space-y-2">
          {healthFindings.map((f) => (
            <div key={f.id} className="flex items-start gap-2 text-sm">
              {f.severity === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
              )}
              <span className="text-white/70">{f.message}</span>
            </div>
          ))}
          {healthFindings.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <ShieldCheck className="w-4 h-4" /> No data-consistency issues found.
            </div>
          )}
        </div>
      </StatCard>

      <DataExportPanel />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs text-white/40 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold tabular-nums text-white">{formatCurrency(value)}</div>
    </div>
  )
}
