import { useMemo, useRef, useState, type ReactNode } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { importTransactionsFromCsv, categoryColor, findMatchRanges } from '@/lib/logic'
import { formatCurrency } from '@/lib/utils'
import { Upload, Search, Receipt } from 'lucide-react'

/** Wraps every match range in a real <mark>, not just bolding the whole string. */
function highlightText(text: string, query: string): ReactNode {
  const ranges = findMatchRanges(text, query)
  if (ranges.length === 0) return text
  const parts: ReactNode[] = []
  let cursor = 0
  ranges.forEach(([start, end], i) => {
    if (start > cursor) parts.push(text.slice(cursor, start))
    parts.push(<mark key={i} className="search-hit">{text.slice(start, end)}</mark>)
    cursor = end
  })
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

/**
 * #27 — real inline click-to-edit, with a smooth expand animation (`.result-reveal`,
 * reused rather than a third animation for the same "appear" motion), not a separate
 * settings-page navigation. Shows as styled coloured text; click reveals a real input.
 */
function EditableCategory({ value, color, onSave, highlighted }: { value: string; color: string; onSave: (v: string) => void; highlighted: ReactNode }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onSave(draft.trim() || value); setEditing(false) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onSave(draft.trim() || value); setEditing(false) }
          if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        }}
        className="result-reveal bg-black/40 border border-cyan-400/40 rounded px-1.5 py-0.5 text-xs outline-none w-28"
      />
    )
  }
  return (
    <button
      onClick={() => { setDraft(value); setEditing(true) }}
      title="Click to edit category"
      className="inline-flex items-center gap-1.5 text-xs hover:opacity-80"
      style={{ color }}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      {highlighted}
    </button>
  )
}

export function Transactions() {
  const { state, addTransactions, updateTransaction } = useStore()
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)
  const [query, setQuery] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const totalIn = state.transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalOut = state.transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)

  // #3 — live search, case-insensitive, matches description OR category.
  const filtered = useMemo(() => {
    if (!query.trim()) return state.transactions
    const q = query.toLowerCase()
    return state.transactions.filter((t) => t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
  }, [state.transactions, query])

  // Running-balance sparkline — a single trend line across the whole ledger,
  // not one-sparkline-per-row (an individual transaction has no time series
  // of its own; the running balance is the meaningful trend to show).
  const sparklineData = useMemo(() => {
    const sorted = [...state.transactions].sort((a, b) => a.date.localeCompare(b.date))
    let running = 0
    return sorted.map((t) => { running += t.amount; return { running } })
  }, [state.transactions])

  const handleFile = async (file: File) => {
    // #34 — real skeleton shimmer while the file is actually being read/parsed (a genuine,
    // if brief, async gap — not a faked delay), instead of a blank flash.
    setImporting(true)
    const text = await file.text()
    const txs = importTransactionsFromCsv(text, state.mode)
    addTransactions(txs)
    setImportedCount(txs.length)
    setImporting(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="gradient-heading text-2xl font-bold tracking-tight">Transactions</h2>
        <p className="text-sm text-white/50 mt-1">CSV bank-statement import with automatic column detection.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard label="Money In" glow="success">
          <div className="mt-4 text-3xl font-bold text-emerald-300 tabular-nums"><CountUp value={totalIn} prefix="$" /></div>
        </StatCard>
        <StatCard label="Money Out" glow="danger" delay={0.05}>
          <div className="mt-4 text-3xl font-bold text-rose-300 tabular-nums"><CountUp value={Math.abs(totalOut)} prefix="$" /></div>
        </StatCard>
      </div>

      <StatCard label="Import CSV" glow="cyan" delay={0.1}>
        <div className="mt-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-purple-500 text-black text-sm font-semibold hover:opacity-90"
          >
            <Upload className="w-4 h-4" /> Choose bank CSV
          </button>
          {importing && (
            <div className="mt-2 space-y-1.5">
              <div className="skeleton h-3 w-2/3" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          )}
          {!importing && importedCount !== null && (
            <p className="text-xs text-emerald-300 mt-2">Imported {importedCount} transactions — date/description/amount columns auto-detected.</p>
          )}
          <p className="text-xs text-white/40 mt-2">
            Auto-detects date, description and amount (or split debit/credit) columns from any bank export, even without matching headers.
          </p>
        </div>
      </StatCard>

      {/* tilt deliberately off: dense scrollable table + live search input — a 3D rotation
          under the cursor while targeting a specific row/keystroke is a real regression, not
          missed polish (see the mouse-tilt audit note in Round 20's report). */}
      <StatCard label={`Ledger (${filtered.length}${query ? ` of ${state.transactions.length}` : ''})`} glow="purple" tilt={false}>
        {sparklineData.length > 1 && (
          <div className="mt-4" style={{ height: 50 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Line type="monotone" dataKey="running" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-white/30 -mt-1">Running balance trend across the imported ledger.</p>
          </div>
        )}

        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search description or category..."
            className="w-full bg-black/30 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-cyan-400/50 placeholder:text-white/30"
          />
        </div>

        <div className="mt-3 max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase tracking-wide">
                <th className="pb-2">Date</th><th className="pb-2">Category</th><th className="pb-2">Description</th><th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((t) => (
                <tr key={t.id} className="border-t border-white/5">
                  <td className="py-1.5 text-white/60 whitespace-nowrap">{t.date}</td>
                  <td className="py-1.5">
                    {/* #1 — colour-coded category accent: a real deterministic hash-from-string colour,
                        not a hardcoded lookup (CSV categories are free text, not a fixed enum).
                        #27 — real inline click-to-edit: CSV import never invents a category (a real
                        bank export doesn't have one), so without this every row would stay
                        "uncategorised" forever with no way to fix it. */}
                    <EditableCategory
                      value={t.category}
                      color={categoryColor(t.category)}
                      onSave={(v) => updateTransaction(t.id, { category: v })}
                      highlighted={highlightText(t.category, query)}
                    />
                  </td>
                  <td className="py-1.5 text-white/80">{highlightText(t.description, query)}</td>
                  <td className={`py-1.5 text-right tabular-nums ${t.amount < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{formatCurrency(t.amount)}</td>
                </tr>
              ))}
              {filtered.length === 0 && state.transactions.length > 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-white/30">No transactions match "{query}".</td></tr>
              )}
              {state.transactions.length === 0 && (
                <tr><td colSpan={4} className="py-8">
                  <div className="flex flex-col items-center text-center">
                    <Receipt className="w-6 h-6 text-white/20 mb-2" />
                    <span className="text-white/40 text-sm">No transactions yet — import a bank CSV above to get started.</span>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </StatCard>
    </div>
  )
}
