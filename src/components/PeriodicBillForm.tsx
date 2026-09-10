import { useState } from 'react'
import { StatCard } from './StatCard'
import type { PeriodicBill } from '@/lib/types'
import { X } from 'lucide-react'
import { formatNumericDate } from '@/lib/utils'

export interface PeriodicBillFormValues {
  name: string
  gaugePeriodStart: string
  gaugePeriodEnd: string
  projectedCharge: number
  inCredit: boolean
  creditAmount: number
  smoothingEnabled: boolean
}

function toFormValues(bill?: PeriodicBill): PeriodicBillFormValues {
  if (!bill) {
    return {
      name: '',
      gaugePeriodStart: '',
      gaugePeriodEnd: '',
      projectedCharge: 0,
      inCredit: false,
      creditAmount: 0,
      smoothingEnabled: true,
    }
  }
  return {
    name: bill.name,
    gaugePeriodStart: bill.gaugePeriodStart,
    gaugePeriodEnd: bill.gaugePeriodEnd,
    projectedCharge: bill.projectedCharge,
    inCredit: bill.inCredit,
    creditAmount: bill.creditAmount,
    smoothingEnabled: bill.smoothingEnabled,
  }
}

/**
 * Add/edit form for a usage-metered Periodic Bill — the same gauge component
 * Gas/Electricity already use, now user-addable from the app itself rather
 * than only seedable in code. Reused for both add (no `existing`) and edit.
 */
export function PeriodicBillForm({
  existing,
  onSave,
  onCancel,
}: {
  existing?: PeriodicBill
  onSave: (values: PeriodicBillFormValues) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<PeriodicBillFormValues>(() => toFormValues(existing))
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof PeriodicBillFormValues>(key: K, val: PeriodicBillFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: val }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!values.name.trim()) return setError('Name is required.')
    if (!values.gaugePeriodStart || !values.gaugePeriodEnd) return setError('Both period start and end dates are required.')
    if (values.gaugePeriodEnd <= values.gaugePeriodStart) return setError('Period end must be after period start.')
    if (values.projectedCharge < 0) return setError('Projected charge cannot be negative.')
    setError(null)
    onSave(values)
  }

  // tilt off: dense multi-field form — kept from the app-wide mouse-tilt audit.
  return (
    <StatCard label={existing ? `Edit ${existing.name}` : 'Add Periodic Bill'} glow="cyan" tilt={false}>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="flex justify-between items-start">
          <p className="text-xs text-white/40 max-w-sm">
            For any usage-metered bill (power, gas, water-by-usage, etc) — gets the same projected-charge gauge and fortnightly-smoothing suggestion as Gas/Electricity.
          </p>
          <button type="button" onClick={onCancel} className="text-white/30 hover:text-white shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="text-xs text-white/50">Bill name</label>
          <input
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Water"
            className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-cyan-400/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/50">Current period start</label>
            <input
              type="date"
              value={values.gaugePeriodStart}
              onChange={(e) => set('gaugePeriodStart', e.target.value)}
              className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-cyan-400/50"
            />
            {/* Real DD/MM/YYYY read-out — the native input's own digits follow the browser's
                OS/locale, not this page (confirmed: lang="en-NZ" on the input changes nothing). */}
            {values.gaugePeriodStart && <span className="block text-[10px] text-white/30 mt-1 tabular-nums">{formatNumericDate(values.gaugePeriodStart)}</span>}
          </div>
          <div>
            <label className="text-xs text-white/50">Current period end</label>
            <input
              type="date"
              value={values.gaugePeriodEnd}
              onChange={(e) => set('gaugePeriodEnd', e.target.value)}
              className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-cyan-400/50"
            />
            {values.gaugePeriodEnd && <span className="block text-[10px] text-white/30 mt-1 tabular-nums">{formatNumericDate(values.gaugePeriodEnd)}</span>}
          </div>
        </div>

        <div>
          <label className="text-xs text-white/50">Projected charge for this period</label>
          <div className="mt-1 flex items-center gap-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 focus-within:border-cyan-400/50">
            <span className="text-white/40">$</span>
            <input
              type="number"
              step="0.01"
              value={values.projectedCharge}
              onChange={(e) => set('projectedCharge', parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent outline-none tabular-nums"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="in-credit-checkbox"
            type="checkbox"
            checked={values.inCredit}
            onChange={(e) => set('inCredit', e.target.checked)}
            className="accent-emerald-400 w-4 h-4"
          />
          <label htmlFor="in-credit-checkbox" className="text-sm text-white/70">Account is currently in credit</label>
        </div>

        {values.inCredit && (
          <div>
            <label className="text-xs text-white/50">Credit balance</label>
            <div className="mt-1 flex items-center gap-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 focus-within:border-emerald-400/50">
              <span className="text-white/40">$</span>
              <input
                type="number"
                step="0.01"
                value={values.creditAmount}
                onChange={(e) => set('creditAmount', parseFloat(e.target.value) || 0)}
                className="w-full bg-transparent outline-none tabular-nums"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            id="smoothing-checkbox"
            type="checkbox"
            checked={values.smoothingEnabled}
            onChange={(e) => set('smoothingEnabled', e.target.checked)}
            className="accent-cyan-400 w-4 h-4"
          />
          <label htmlFor="smoothing-checkbox" className="text-sm text-white/70">
            Fold the suggested fortnightly set-aside into Live Funds Available
          </label>
        </div>
        <p className="text-[11px] text-white/35 -mt-2">
          Off = informational gauge only, no cash-flow impact on Upcoming Payments.
        </p>

        {error && <p className="text-sm text-rose-300">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-purple-500 text-black text-sm font-semibold hover:opacity-90"
          >
            {existing ? 'Save changes' : 'Add bill'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-white/10 text-white/60 text-sm hover:text-white hover:border-white/30"
          >
            Cancel
          </button>
        </div>
      </form>
    </StatCard>
  )
}
