import { StatCard } from './StatCard'
import { useStore } from '@/lib/store'
import { AlertCircle } from 'lucide-react'

/**
 * Accounts — liquid bank balances (HSBC, Overdraft, Savings) plus manually-
 * maintained non-liquid assets (Car, Home, Other). HSBC + Overdraft feed
 * Live Funds Available; Savings does not (not meant to be spent day-to-day);
 * all six feed Net Worth. Assets are NEVER auto-valued from a live market
 * API — the UI says so explicitly, and Deep edits the numbers himself.
 */
export function AccountsPanel({ compact = false }: { compact?: boolean }) {
  const { state, updateAccount } = useStore()
  const liquid = state.accounts.filter((a) => a.type === 'liquid')
  const assets = state.accounts.filter((a) => a.type === 'asset')

  return (
    <StatCard label="Accounts" glow="purple" tilt={false}>
      <div className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Liquid Accounts</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {liquid.map((a) => (
            <AccountInput key={a.id} name={a.name} value={a.value} onChange={(v) => updateAccount(a.id, { value: v })} />
          ))}
        </div>
      </div>

      {!compact && (
        <div className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2 flex items-center gap-1.5">
            Non-Liquid Assets
            <span className="flex items-center gap-1 text-[10px] font-normal text-amber-300/80 normal-case tracking-normal">
              <AlertCircle className="w-3 h-3" /> manually maintained — never a live market value
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {assets.map((a) => (
              <AccountInput key={a.id} name={a.name} value={a.value} onChange={(v) => updateAccount(a.id, { value: v })} />
            ))}
          </div>
        </div>
      )}
    </StatCard>
  )
}

function AccountInput({ name, value, onChange }: { name: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <label className="text-xs font-semibold uppercase tracking-wide text-white/60">{name}</label>
      <div className="mt-2 flex items-center gap-1">
        <span className="text-white/40">$</span>
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full bg-transparent text-xl font-bold tabular-nums text-white outline-none border-b border-white/10 focus:border-cyan-400/60"
        />
      </div>
    </div>
  )
}
