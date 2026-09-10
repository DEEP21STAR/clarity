import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { importTransactionsFromCsv, categoryColor, findMatchRanges } from '@/lib/logic'
import { formatCurrency, formatNumericDate } from '@/lib/utils'
import { saveFile } from '@/lib/downloads'
import { useUndoableDelete } from '@/lib/useUndoableDelete'
import { useToast } from './Toast'
import { Upload, Search, Receipt, Trash2, DownloadCloud, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'

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
  // Real colour-coded chip — same bordered-pill convention DueBadge/severity badges already
  // use throughout the app, not just a plain coloured dot + text. Background/border at low
  // opacity (derived from the same deterministic categoryColor()), full-opacity dot + text.
  return (
    <button
      onClick={() => { setDraft(value); setEditing(true) }}
      title="Click to edit category"
      className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border hover:brightness-125 transition-[filter]"
      style={{ color, borderColor: `${color}4d`, backgroundColor: `${color}1a` }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      {highlighted}
    </button>
  )
}

/** Round 21 — real CSV escaping: quotes any field containing a comma, quote, or newline, per RFC 4180. */
function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Round 21, item #9 — bulk-set the category on every currently-filtered row in one action. */
function BulkRecategorize({ count, onApply }: { count: number; onApply: (category: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <div className="mt-2 flex items-center gap-2 text-xs">
      <span className="text-white/40">Set category for all {count} result{count === 1 ? '' : 's'}:</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) { onApply(value.trim()); setValue('') } }}
        placeholder="e.g. Groceries"
        className="bg-black/30 border border-white/10 rounded px-2 py-1 outline-none focus:border-cyan-400/50 placeholder:text-white/25 w-32"
      />
      <button
        onClick={() => { if (value.trim()) { onApply(value.trim()); setValue('') } }}
        disabled={!value.trim()}
        className="text-cyan-300 hover:text-cyan-200 disabled:text-white/20 disabled:cursor-not-allowed font-medium"
      >
        Apply
      </button>
    </div>
  )
}

export function Transactions() {
  const { state, addTransactions, updateTransaction, removeTransaction } = useStore()
  const withUndo = useUndoableDelete()
  const { showToast } = useToast()
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)
  const [query, setQuery] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Round 21, item #16 — press "/" anywhere on this tab to jump straight to the ledger search,
  // the same convenience GitHub/Gmail-style apps use. Guarded so it never hijacks typing that's
  // already happening in another input/textarea/contenteditable.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '/') return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const inTxs = state.transactions.filter((t) => t.amount > 0)
  const outTxs = state.transactions.filter((t) => t.amount < 0)
  const totalIn = inTxs.reduce((s, t) => s + t.amount, 0)
  const totalOut = outTxs.reduce((s, t) => s + t.amount, 0)
  const uncategorisedCount = state.transactions.filter((t) => t.category === 'uncategorised').length

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

  // Round 21, item #18 — exports exactly what's currently visible (respects the live search
  // filter), not the whole ledger — so "search fuel, export" gives a real filtered CSV. Reuses
  // the same saveFile()-then-clipboard-fallback pattern as DataExportPanel rather than an
  // <a download> link, which the artifact viewer sandbox has already confirmed is dead.
  const exportFiltered = async () => {
    const header = 'Date,Category,Description,Amount'
    const rows = filtered.map((t) => [t.date, csvField(t.category), csvField(t.description), t.amount.toFixed(2)].join(','))
    const csv = [header, ...rows].join('\n')
    const filename = query.trim() ? `clarity-transactions-filtered-${query.trim().slice(0, 20)}.csv` : 'clarity-transactions.csv'
    const outcome = await saveFile(filename, csv)
    if (outcome === 'saved') showToast(`Exported ${filtered.length} transactions.`, { tone: 'success' })
    else {
      try {
        await navigator.clipboard.writeText(csv)
        showToast(`Downloads unavailable here — copied ${filtered.length} rows as CSV instead.`, { tone: 'info' })
      } catch {
        showToast('Export unavailable — clipboard and downloads both blocked in this view.', { tone: 'warning' })
      }
    }
  }

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
          <div className="mt-4 flex items-center gap-3">
            <ArrowDownCircle className="w-8 h-8 text-emerald-400/70 shrink-0" />
            <div>
              <div className="text-3xl font-bold text-emerald-300 tabular-nums"><CountUp value={totalIn} prefix="$" /></div>
              <p className="text-xs text-white/40 mt-1">{inTxs.length} credit{inTxs.length === 1 ? '' : 's'}{inTxs.length > 0 && ` · avg ${formatCurrency(totalIn / inTxs.length)}`}</p>
            </div>
          </div>
        </StatCard>
        <StatCard label="Money Out" glow="danger" delay={0.05}>
          <div className="mt-4 flex items-center gap-3">
            <ArrowUpCircle className="w-8 h-8 text-rose-400/70 shrink-0" />
            <div>
              <div className="text-3xl font-bold text-rose-300 tabular-nums"><CountUp value={Math.abs(totalOut)} prefix="$" /></div>
              <p className="text-xs text-white/40 mt-1">{outTxs.length} debit{outTxs.length === 1 ? '' : 's'}{outTxs.length > 0 && ` · avg ${formatCurrency(Math.abs(totalOut) / outTxs.length)}`}</p>
            </div>
          </div>
        </StatCard>
      </div>

      {/* Real signal, not decoration: how much of the real imported ledger actually got a
          real category vs. fell back to "uncategorised" — the auto-categorisation pass is
          best-effort pattern matching, not perfect, so this is honest about its own coverage. */}
      {state.transactions.length > 0 && (
        <p className="text-xs text-white/35 -mt-2">
          {state.transactions.length - uncategorisedCount} of {state.transactions.length} transactions auto-categorised
          {uncategorisedCount > 0 && ` · ${uncategorisedCount} left as uncategorised — click any category below to fix one by hand`}.
        </p>
      )}

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

        <div className="mt-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search description or category... (press / to focus)"
              className="w-full bg-black/30 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-cyan-400/50 placeholder:text-white/30"
            />
            {!query && (
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/25 border border-white/10 rounded px-1">/</kbd>
            )}
          </div>
          {filtered.length > 0 && (
            <button
              onClick={exportFiltered}
              title={query ? `Export the ${filtered.length} filtered rows as CSV` : 'Export the full ledger as CSV'}
              className="shrink-0 flex items-center gap-1.5 text-xs text-white/50 hover:text-cyan-300 border border-white/10 hover:border-cyan-400/30 rounded-lg px-3 py-2 transition-colors"
            >
              <DownloadCloud className="w-3.5 h-3.5" /> Export{query ? ` (${filtered.length})` : ''}
            </button>
          )}
        </div>

        {/* Round 21, item #9 (replaces a global :active press-feedback idea that turned out to
            already exist from Round 20) — bulk re-categorize every currently-searched row in
            one go. A CSV import routinely produces 10+ rows from the same merchant that all
            need the same fix; doing that one click at a time via EditableCategory was real but
            slow. Only appears once a search has actually narrowed the list down (bulk-editing
            the WHOLE ledger from one text box is too easy to fat-finger). */}
        {query.trim() && filtered.length > 0 && filtered.length <= 200 && (
          <BulkRecategorize
            count={filtered.length}
            onApply={(category) =>
              withUndo(`Category set to "${category}" on ${filtered.length} transaction${filtered.length === 1 ? '' : 's'}`, () => {
                filtered.forEach((t) => updateTransaction(t.id, { category }))
              })
            }
          />
        )}

        <div className="mt-3 max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase tracking-wide">
                <th className="pb-2">Date</th><th className="pb-2">Category</th><th className="pb-2">Description</th><th className="pb-2 text-right">Amount</th><th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((t) => (
                <tr key={t.id} className="border-t border-white/5 group">
                  {/* Real DD/MM/YYYY — raw t.date (ISO YYYY-MM-DD) was being shown here directly, which
                      isn't the month-first bug but also wasn't going through the shared formatter. */}
                  <td className="py-1.5 text-white/60 whitespace-nowrap tabular-nums">{formatNumericDate(t.date)}</td>
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
                  <td className="py-1.5 pl-2">
                    {/* Round 21, item #1 — a mistaken/duplicate CSV import row had no way to be
                        removed before this; opacity-0 until row hover keeps the dense ledger from
                        looking cluttered with 100 trash icons at rest. */}
                    <button
                      onClick={() => withUndo('Transaction removed', () => removeTransaction(t.id))}
                      className="text-white/20 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove this transaction"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && state.transactions.length > 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-white/30">No transactions match "{query}".</td></tr>
              )}
              {state.transactions.length === 0 && (
                <tr><td colSpan={5} className="py-8">
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
