import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { DataExportPanel } from './DataExportPanel'
import { calcWfhFixedRate, gstOnExclusive, gstFromInclusive, NZ_WFH_FIXED_RATE_PER_HOUR, AU_WFH_FIXED_RATE_PER_HOUR, calcRoundUpSavings } from '@/lib/logic'
import { formatCurrency, todayIso } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-react'

export function Tools() {
  const { state, addOneOffEntry, removeOneOffEntry } = useStore()
  const [hoursPerWeek, setHoursPerWeek] = useState(15)
  const [weeksPerYear, setWeeksPerYear] = useState(48)
  const [gstDirection, setGstDirection] = useState<'ex' | 'inc'>('ex')
  const [gstAmount, setGstAmount] = useState(100)
  const [roundTo, setRoundTo] = useState(5)
  const [oneOffDesc, setOneOffDesc] = useState('')
  const [oneOffAmount, setOneOffAmount] = useState(0)
  const [oneOffDate, setOneOffDate] = useState(todayIso())

  const roundUpSavings = useMemo(() => calcRoundUpSavings(state.transactions, roundTo), [state.transactions, roundTo])

  const rate = state.country === 'NZ' ? NZ_WFH_FIXED_RATE_PER_HOUR : AU_WFH_FIXED_RATE_PER_HOUR
  const wfhDeduction = useMemo(() => calcWfhFixedRate(hoursPerWeek, weeksPerYear, rate), [hoursPerWeek, weeksPerYear, rate])

  const gstResult = useMemo(
    () => (gstDirection === 'ex' ? gstOnExclusive(gstAmount, state.country) : gstFromInclusive(gstAmount, state.country)),
    [gstDirection, gstAmount, state.country]
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Tools</h2>
        <p className="text-sm text-white/50 mt-1">Home-office deduction and GST calculators.</p>
      </div>

      <StatCard label="Home Office / WFH Deduction" glow="cyan" tilt={false}>
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
        <div className="mt-2 text-3xl font-bold text-cyan-300 tabular-nums"><CountUp value={wfhDeduction} prefix="$" /></div>
        <p className="text-xs text-white/40 mt-1">Estimated annual deduction — editable rate/inputs, not a lodged claim.</p>
      </StatCard>

      <StatCard label="GST Calculator" glow="purple" tilt={false}>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setGstDirection('ex')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${gstDirection === 'ex' ? 'bg-gradient-to-r from-cyan-400 to-purple-500 text-black' : 'border border-white/10 text-white/50'}`}>
            Ex-GST → Inc-GST
          </button>
          <button onClick={() => setGstDirection('inc')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${gstDirection === 'inc' ? 'bg-gradient-to-r from-cyan-400 to-purple-500 text-black' : 'border border-white/10 text-white/50'}`}>
            Inc-GST → Ex-GST
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-white/40">$</span>
          <input type="number" value={gstAmount} onChange={(e) => setGstAmount(parseFloat(e.target.value) || 0)} className="bg-transparent text-2xl font-bold tabular-nums text-purple-200 outline-none border-b border-white/10 focus:border-purple-400/60 w-full" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <Metric label="Ex-GST" value={gstResult.amountExGst} />
          <Metric label="GST" value={gstResult.gst} />
          <Metric label="Inc-GST" value={gstResult.amountIncGst} />
        </div>
        <p className="text-xs text-white/40 mt-3">{state.country} GST rate: {state.country === 'NZ' ? '15%' : '10%'}.</p>
      </StatCard>

      <StatCard label="Round-Up Savings Simulator" glow="amber" tilt={false}>
        <p className="mt-4 text-xs text-amber-300/80 font-semibold uppercase tracking-wide">Simulation only — moves no real money</p>
        <div className="mt-2 flex items-center gap-2 text-sm text-white/50">
          Round every purchase up to the nearest
          <select value={roundTo} onChange={(e) => setRoundTo(Number(e.target.value))} className="bg-black/40 rounded px-2 py-1 text-xs outline-none border border-white/10">
            {[1, 2, 5, 10].map((r) => <option key={r} value={r}>${r}</option>)}
          </select>
        </div>
        <div className="mt-2 text-3xl font-bold text-amber-300 tabular-nums"><CountUp value={roundUpSavings} prefix="$" /></div>
        <p className="text-xs text-white/40 mt-1">You'd have "saved" this much across all imported transactions, if every purchase rounded up.</p>
      </StatCard>

      <StatCard label="One-Off Entries" glow="cyan" tilt={false}>
        <p className="mt-4 text-xs text-white/40">One-off income/expenses feed the Cash-Flow Forecast chart on Upcoming Payments — a bonus, a big purchase, anything outside the regular bill/pay cycle.</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
          <input value={oneOffDesc} onChange={(e) => setOneOffDesc(e.target.value)} placeholder="Description" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-400/50 md:col-span-2" />
          <input type="date" value={oneOffDate} onChange={(e) => setOneOffDate(e.target.value)} className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-400/50" />
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
          {state.oneOffEntries.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm border-t border-white/5 pt-1.5">
              <span className="text-white/60">{e.date} — {e.description}</span>
              <div className="flex items-center gap-2">
                <span className={`tabular-nums ${e.amount < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{formatCurrency(e.amount)}</span>
                <button onClick={() => removeOneOffEntry(e.id)} className="text-white/30 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
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
