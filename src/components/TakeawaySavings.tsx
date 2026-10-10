import { useState } from 'react'
import { ShoppingBag, ClipboardPaste, Pencil } from 'lucide-react'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { formatCurrency } from '@/lib/utils'
import {
  loadTakeaways,
  monthlySavingPotential,
  parseNutryosCode,
  saveTakeaways,
  savedSoFar,
  type TakeawayState,
} from '@/lib/takeaways'

const GOAL_DAYS = 30

/**
 * Money not spent on takeaways. Days come from NUTRYOS (paste the code its "For Clarity" button
 * copies) or are typed in. The figure is an estimate (days x typical cost x how often takeaways
 * used to happen) and says so on the card.
 */
export function TakeawaySavings() {
  const [s, setS] = useState<TakeawayState>(loadTakeaways)
  const [editing, setEditing] = useState(false)
  const [paste, setPaste] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [d, setD] = useState({ days: '', cost: '', perWeek: '' })

  const saved = savedSoFar(s)
  const potential = monthlySavingPotential(s)
  const pct = Math.min(100, (s.days / GOAL_DAYS) * 100)

  function commit(next: TakeawayState) {
    setS(next)
    saveTakeaways(next)
  }

  function importCode() {
    const p = parseNutryosCode(paste)
    if (!p) {
      setMsg('That is not a NUTRYOS code. Use "For Clarity" in NUTRYOS Healthy habits.')
      return
    }
    commit({ ...s, ...p })
    setPaste('')
    setMsg(`Imported ${p.days} takeaway-free days.`)
  }

  function saveManual() {
    const days = Number(d.days), cost = Number(d.cost), pw = Number(d.perWeek)
    commit({
      days: Number.isFinite(days) && days >= 0 ? Math.floor(days) : s.days,
      asOf: s.asOf,
      cost: Number.isFinite(cost) && cost > 0 ? cost : s.cost,
      perWeek: Number.isFinite(pw) && pw > 0 && pw <= 21 ? pw : s.perWeek,
    })
    setEditing(false)
    setMsg(null)
  }

  return (
    <StatCard label="Takeaways Not Bought" glow="success" tooltip="An estimate: takeaway-free days x what a typical takeaway costs x how often you used to order. Days come from NUTRYOS or are typed in.">
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-emerald-300">
            <ShoppingBag className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Estimated saved</span>
          </div>
          <div className="mt-1 text-4xl font-black tabular-nums ux-hero-number">
            {saved === null ? <span className="text-white/50 text-2xl">Add a cost</span> : <CountUp value={saved} prefix="$" decimals={2} />}
          </div>
          <p className="mt-1 text-xs text-white/60">
            {s.days} takeaway-free day{s.days === 1 ? '' : 's'}
            {s.cost ? ` at ${formatCurrency(s.cost)} each, about ${s.perWeek} a week before` : ''}
            {s.asOf ? ` (as of ${s.asOf})` : ''}
          </p>
        </div>
        {potential !== null && (
          <p className="text-xs text-white/60 max-w-[15rem] text-left sm:text-right">
            A full takeaway-free month would save about <span className="text-emerald-300 font-semibold">{formatCurrency(potential)}</span>.
          </p>
        )}
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs text-white/50 mb-1.5">
          <span>Toward a {GOAL_DAYS}-day streak</span>
          <span>{Math.min(s.days, GOAL_DAYS)} / {GOAL_DAYS}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={GOAL_DAYS} aria-valuenow={Math.min(s.days, GOAL_DAYS)}>
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          aria-label="Paste NUTRYOS code"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') importCode() }}
          placeholder="Paste NUTRYOS-TF code"
          className="min-w-0 basis-full sm:basis-0 sm:flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
        />
        <button onClick={importCode} className="flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-200">
          <ClipboardPaste className="w-4 h-4" /> Import
        </button>
        <button
          onClick={() => { setD({ days: String(s.days), cost: s.cost ? String(s.cost) : '', perWeek: String(s.perWeek) }); setEditing((v) => !v) }}
          className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold"
        >
          <Pencil className="w-4 h-4" /> Edit
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-white/60" role="status">{msg}</p>}

      {editing && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([['days', 'Days free'], ['cost', 'Cost each ($)'], ['perWeek', 'Per week before']] as const).map(([k, label]) => (
            <label key={k} className="text-xs text-white/60">
              {label}
              <input
                inputMode="decimal"
                value={d[k]}
                onChange={(e) => setD({ ...d, [k]: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-sm text-white"
              />
            </label>
          ))}
          <button onClick={saveManual} className="col-span-3 rounded-lg bg-emerald-400 px-3 py-2 text-sm font-bold text-black">Save</button>
        </div>
      )}
    </StatCard>
  )
}
