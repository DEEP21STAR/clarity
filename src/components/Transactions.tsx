import { useMemo, useRef, useState } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { importTransactionsFromCsv } from '@/lib/logic'
import { formatCurrency } from '@/lib/utils'
import { Upload } from 'lucide-react'

export function Transactions() {
  const { state, addTransactions } = useStore()
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const totalIn = state.transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalOut = state.transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)

  // Running-balance sparkline — a single trend line across the whole ledger,
  // not one-sparkline-per-row (an individual transaction has no time series
  // of its own; the running balance is the meaningful trend to show).
  const sparklineData = useMemo(() => {
    const sorted = [...state.transactions].sort((a, b) => a.date.localeCompare(b.date))
    let running = 0
    return sorted.map((t) => { running += t.amount; return { running } })
  }, [state.transactions])

  const handleFile = async (file: File) => {
    const text = await file.text()
    const txs = importTransactionsFromCsv(text, state.mode)
    addTransactions(txs)
    setImportedCount(txs.length)
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
        <StatCard label="Money Out" glow="danger">
          <div className="mt-4 text-3xl font-bold text-rose-300 tabular-nums"><CountUp value={Math.abs(totalOut)} prefix="$" /></div>
        </StatCard>
      </div>

      <StatCard label="Import CSV" glow="cyan" tilt={false}>
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
          {importedCount !== null && (
            <p className="text-xs text-emerald-300 mt-2">Imported {importedCount} transactions — date/description/amount columns auto-detected.</p>
          )}
          <p className="text-xs text-white/40 mt-2">
            Auto-detects date, description and amount (or split debit/credit) columns from any bank export, even without matching headers.
          </p>
        </div>
      </StatCard>

      <StatCard label={`Ledger (${state.transactions.length})`} glow="purple" tilt={false}>
        {sparklineData.length > 1 && (
          <div className="mt-4" style={{ height: 50 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Line type="monotone" dataKey="running" stroke="#22d3ee" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-white/30 -mt-1">Running balance trend across the imported ledger.</p>
          </div>
        )}
        <div className="mt-4 max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase tracking-wide">
                <th className="pb-2">Date</th><th className="pb-2">Description</th><th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {state.transactions.slice(0, 100).map((t) => (
                <tr key={t.id} className="border-t border-white/5">
                  <td className="py-1.5 text-white/60">{t.date}</td>
                  <td className="py-1.5 text-white/80">{t.description}</td>
                  <td className={`py-1.5 text-right tabular-nums ${t.amount < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{formatCurrency(t.amount)}</td>
                </tr>
              ))}
              {state.transactions.length === 0 && (
                <tr><td colSpan={3} className="py-4 text-center text-white/30">No transactions yet — import a CSV above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </StatCard>
    </div>
  )
}
