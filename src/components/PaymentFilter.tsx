import type { PaymentHistoryFilter } from '@/lib/logic'
import { Filter, X } from 'lucide-react'
import { DateField } from './DateField'

export interface PaymentFilterTarget {
  id: string
  label: string
}

/**
 * #8 expanded, Round 20 — the ONE reusable filter control every payment-
 * history view in the app uses (Deep was explicit: "Filters need to apply
 * to all areas," so this is a single controlled component + the shared
 * filterPaymentRecords() in logic.ts, not a one-off per screen). Filters by
 * target (which bill/card/plan) and by date range — at minimum, per the ask.
 */
export function PaymentFilterBar({ targets, filter, onChange }: {
  targets: PaymentFilterTarget[]
  filter: PaymentHistoryFilter
  onChange: (filter: PaymentHistoryFilter) => void
}) {
  const hasActiveFilter = !!(filter.targetId || filter.startDate || filter.endDate)
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="flex items-center gap-1 text-white/40"><Filter className="w-3 h-3" /> Filter</span>
      <select
        value={filter.targetId ?? ''}
        onChange={(e) => onChange({ ...filter, targetId: e.target.value || undefined })}
        className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 outline-none focus:border-cyan-400/50"
      >
        <option value="">All bills / cards</option>
        {targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <span className="text-white/30">from</span>
      <DateField
        value={filter.startDate ?? ''}
        onChange={(v) => onChange({ ...filter, startDate: v || undefined })}
        inputClassName="bg-black/30 border border-white/10 rounded-lg px-2 py-1 outline-none focus:border-cyan-400/50"
        overlayClassName="px-2"
        placeholder="any"
      />
      <span className="text-white/30">to</span>
      <DateField
        value={filter.endDate ?? ''}
        onChange={(v) => onChange({ ...filter, endDate: v || undefined })}
        inputClassName="bg-black/30 border border-white/10 rounded-lg px-2 py-1 outline-none focus:border-cyan-400/50"
        overlayClassName="px-2"
        placeholder="any"
      />
      {hasActiveFilter && (
        <button onClick={() => onChange({})} className="flex items-center gap-1 text-white/40 hover:text-white">
          <X className="w-3 h-3" /> Clear
        </button>
      )}
    </div>
  )
}
