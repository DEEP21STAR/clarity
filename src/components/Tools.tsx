import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { calcWfhFixedRate, gstOnExclusive, gstFromInclusive, NZ_WFH_FIXED_RATE_PER_HOUR, AU_WFH_FIXED_RATE_PER_HOUR } from '@/lib/logic'
import { formatCurrency } from '@/lib/utils'

export function Tools() {
  const { state } = useStore()
  const [hoursPerWeek, setHoursPerWeek] = useState(15)
  const [weeksPerYear, setWeeksPerYear] = useState(48)
  const [gstDirection, setGstDirection] = useState<'ex' | 'inc'>('ex')
  const [gstAmount, setGstAmount] = useState(100)

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
