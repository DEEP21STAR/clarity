import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useToast } from './Toast'
import { todayIso, formatCurrency } from '@/lib/utils'
import type { PaymentTargetType } from '@/lib/types'
import { CircleDollarSign, X } from 'lucide-react'
import { DateField } from './DateField'

/**
 * #8 expanded, Round 20 — the real "record a payment" action Deep asked
 * for after his actual $325 GEM VISA payment had nowhere to go: amount +
 * date, and it actually reduces the target's real balance/remaining
 * (via recordPayment() in store.tsx → applyPayment* in logic.ts), not just
 * a boolean. Small inline expandable form so it stays close to the
 * balance it affects instead of navigating away.
 */
export function RecordPaymentButton({ targetType, targetId, targetLabel, defaultAmount }: {
  targetType: PaymentTargetType
  targetId: string
  targetLabel: string
  defaultAmount?: number
}) {
  const { recordPayment, deletePaymentRecord } = useStore()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(defaultAmount ?? 0)
  const [date, setDate] = useState(todayIso())
  const [shake, setShake] = useState(false)

  const submit = () => {
    if (amount <= 0) {
      setShake(true)
      setTimeout(() => setShake(false), 400)
      return
    }
    const id = recordPayment({ targetType, targetId, targetLabel, amount, date })
    showToast(`${formatCurrency(amount)} payment recorded against ${targetLabel}`, {
      tone: 'success',
      actionLabel: 'Undo',
      onAction: () => deletePaymentRecord(id),
    })
    setOpen(false)
    setAmount(defaultAmount ?? 0)
    setDate(todayIso())
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200 border border-cyan-400/20 hover:border-cyan-400/40 rounded-full px-2 py-1"
      >
        <CircleDollarSign className="w-3 h-3" /> Record a payment
      </button>
    )
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-cyan-400/20 bg-black/30 p-2">
      <div className={`flex items-center gap-1 bg-black/30 border border-white/10 rounded-lg px-2 py-1 ${shake ? 'shake-invalid' : ''}`}>
        <span className="text-white/40 text-xs">$</span>
        <input
          type="number"
          step="0.01"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
          className="w-20 bg-transparent outline-none text-sm tabular-nums"
        />
      </div>
      <DateField
        value={date}
        onChange={setDate}
        inputClassName="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs outline-none focus:border-cyan-400/50"
        overlayClassName="px-2 text-xs"
      />
      <button onClick={submit} className="px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-400 to-purple-500 text-black text-xs font-semibold hover:opacity-90">
        Record
      </button>
      <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}
