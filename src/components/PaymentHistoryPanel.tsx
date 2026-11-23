import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { PaymentFilterBar, type PaymentFilterTarget } from './PaymentFilter'
import { useToast } from './Toast'
import { filterPaymentRecords, type PaymentHistoryFilter } from '@/lib/logic'
import { formatCurrency, formatShortDate } from '@/lib/utils'
import { CreditCard, Receipt, Zap, Smartphone, Trash2, History } from 'lucide-react'
import type { PaymentTargetType } from '@/lib/types'

const TARGET_ICON: Record<PaymentTargetType, typeof CreditCard> = {
  recurringBill: Receipt,
  creditCard: CreditCard,
  installmentPlan: CreditCard,
  periodicBill: Zap,
  deviceRepayment: Smartphone,
}

/**
 * #8 expanded, Round 20 — real, filterable payment history across EVERY
 * balance-bearing thing in the app (GEM VISA cards/plans, recurring bills,
 * periodic bills, device repayments), all writing into the same
 * `state.paymentRecords` ledger via recordPayment() in store.tsx. One place
 * to see "what did I actually pay, and when."
 */
export function PaymentHistoryPanel() {
  const { state, deletePaymentRecord } = useStore()
  const { showToast } = useToast()
  const [filter, setFilter] = useState<PaymentHistoryFilter>({})

  const targets: PaymentFilterTarget[] = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of state.paymentRecords) seen.set(r.targetId, r.targetLabel)
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }))
  }, [state.paymentRecords])

  const filtered = useMemo(() => filterPaymentRecords(state.paymentRecords, filter), [state.paymentRecords, filter])
  const totalShown = useMemo(() => filtered.reduce((s, r) => s + r.amount, 0), [filtered])

  const undo = (id: string, label: string) => {
    deletePaymentRecord(id)
    showToast(`Payment against ${label} removed`, { tone: 'info' })
  }

  return (
    <StatCard label="Payment History" glow="success" tooltip="Every real payment recorded across GEM VISA cards, recurring bills, periodic bills, and device repayments — one filterable ledger.">
      <p className="mt-4 text-xs text-white/40">
        {state.paymentRecords.length} payment{state.paymentRecords.length === 1 ? '' : 's'} recorded, total {formatCurrency(state.paymentRecords.reduce((s, r) => s + r.amount, 0))}.
      </p>
      <div className="mt-3">
        <PaymentFilterBar targets={targets} filter={filter} onChange={setFilter} />
      </div>
      {(filter.targetId || filter.startDate || filter.endDate) && (
        <p className="mt-2 text-xs text-cyan-300">{filtered.length} match{filtered.length === 1 ? '' : 'es'} — {formatCurrency(totalShown)}</p>
      )}
      <div className="mt-3 max-h-72 overflow-y-auto space-y-1.5">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <History className="w-6 h-6 text-white/20 mb-2" />
            <p className="text-sm text-white/40">{state.paymentRecords.length === 0 ? 'No payments recorded yet.' : 'No payments match this filter.'}</p>
          </div>
        )}
        {filtered.map((r) => {
          const Icon = TARGET_ICON[r.targetType]
          return (
            <div key={r.id} className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm">
              <Icon className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-white/80 truncate">{r.targetLabel}</div>
                <div className="text-[10px] text-white/35">{formatShortDate(r.date)}{r.dueDateIso ? ` · against ${formatShortDate(r.dueDateIso)} due date` : ''}</div>
              </div>
              <span className="tabular-nums text-emerald-300 font-semibold">{formatCurrency(r.amount)}</span>
              <button onClick={() => undo(r.id, r.targetLabel)} title="Remove this payment record (reverses its balance effect)" className="text-white/30 hover:text-rose-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </StatCard>
  )
}
