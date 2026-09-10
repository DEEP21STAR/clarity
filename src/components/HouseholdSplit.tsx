import { StatCard } from './StatCard'
import { Disclosure } from './Disclosure'
import { useStore } from '@/lib/store'
import { monthlyEquivalent } from '@/lib/logic'
import { formatCurrency } from '@/lib/utils'

/** Who-owes-what for every shared bill — editable 50/50 (or custom) split between Deep and Mimi. */
export function HouseholdSplit() {
  const { state, updateBill } = useStore()
  const sharedBills = state.bills.filter((b) => b.active && b.owner === 'shared')

  const totals = sharedBills.reduce(
    (acc, b) => {
      const monthly = monthlyEquivalent(b.amount, b.frequency)
      const deepPct = b.sharedSplitDeepPercent ?? 50
      acc.deep += monthly * (deepPct / 100)
      acc.mimi += monthly * ((100 - deepPct) / 100)
      return acc
    },
    { deep: 0, mimi: 0 }
  )

  // tilt off: expandable per-bill % table — kept from the app-wide mouse-tilt audit.
  return (
    <StatCard label="Household Bill Split" glow="purple" tilt={false}>
      {/* Tier 1: the answer that matters, always visible */}
      <div className="mt-4 flex gap-6 text-sm">
        <div>
          <div className="text-xs text-white/40 uppercase tracking-wide">Deep owes / month</div>
          <div className="text-2xl font-bold tabular-nums text-cyan-300">{formatCurrency(totals.deep)}</div>
        </div>
        <div>
          <div className="text-xs text-white/40 uppercase tracking-wide">Mimi owes / month</div>
          <div className="text-2xl font-bold tabular-nums text-pink-300">{formatCurrency(totals.mimi)}</div>
        </div>
      </div>

      {/* Tier 3: granular per-bill breakdown, tucked away */}
      <div className="mt-4">
        <Disclosure title={`Show per-bill breakdown (${sharedBills.length} shared bills)`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/40 text-xs uppercase tracking-wide">
                  <th className="pb-2 pr-2">Bill</th>
                  <th className="pb-2 pr-2">Monthly</th>
                  <th className="pb-2 pr-2">Deep's split</th>
                  <th className="pb-2 pr-2 text-right">Deep owes</th>
                  <th className="pb-2 text-right">Mimi owes</th>
                </tr>
              </thead>
              <tbody>
                {sharedBills.map((b) => {
                  const monthly = monthlyEquivalent(b.amount, b.frequency)
                  const deepPct = b.sharedSplitDeepPercent ?? 50
                  return (
                    <tr key={b.id} className="border-t border-white/5">
                      <td className="py-2 pr-2">{b.name}</td>
                      <td className="py-2 pr-2 tabular-nums text-white/60">{formatCurrency(monthly)}</td>
                      <td className="py-2 pr-2">
                        <input
                          type="number" min={0} max={100} value={deepPct}
                          onChange={(e) => updateBill(b.id, { sharedSplitDeepPercent: Math.max(0, Math.min(100, Number(e.target.value))) })}
                          className="bg-transparent outline-none border-b border-white/10 focus:border-purple-400/50 w-12 tabular-nums"
                        />
                        <span className="text-white/40 text-xs">%</span>
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums text-cyan-300">{formatCurrency(monthly * (deepPct / 100))}</td>
                      <td className="py-2 text-right tabular-nums text-pink-300">{formatCurrency(monthly * ((100 - deepPct) / 100))}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 font-semibold">
                  <td className="py-2" colSpan={3}>Total / month</td>
                  <td className="py-2 text-right tabular-nums text-cyan-300">{formatCurrency(totals.deep)}</td>
                  <td className="py-2 text-right tabular-nums text-pink-300">{formatCurrency(totals.mimi)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Disclosure>
      </div>
    </StatCard>
  )
}
