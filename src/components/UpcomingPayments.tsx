import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { addDaysIso, totalBillsInWindow, totalIncomeInWindow, totalPeriodicSmoothedInWindow, totalSinkingFundsSmoothedInWindow, windowLengthDays, isBillAmountChanged } from '@/lib/logic'
import { cn, formatCurrency, todayIso } from '@/lib/utils'
import type { UpcomingWindow, RecurringBill, BillFrequency, PeriodicBill } from '@/lib/types'
import { Plus, Trash2, Info, AlertTriangle } from 'lucide-react'
import { CreditCardAccountPanel, DeviceRepaymentCard } from './InstallmentPlanTracker'
import { PeriodicBillGauge } from './PeriodicBillGauge'
import { PeriodicBillForm, type PeriodicBillFormValues } from './PeriodicBillForm'
import { AccountsPanel } from './AccountsPanel'
import { SavingsGoalsSection } from './SavingsGoals'
import { SinkingFundsSection } from './SinkingFunds'
import { SpendPaceTracker } from './SpendPaceTracker'
import { CashFlowChart } from './CashFlowChart'
import { HouseholdSplit } from './HouseholdSplit'
import { BillIcon } from './BillIcons'
import { SegmentedControl } from './SegmentedControl'
import { Disclosure } from './Disclosure'
import { fireConfetti } from '@/lib/confetti'

const WINDOWS: { id: UpcomingWindow; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'fortnight', label: 'Fortnight' },
  { id: 'month', label: 'Month' },
]

interface Allocation { food: number; fuel: number; personal: number }
const DEFAULT_ALLOCATION: Allocation = { food: 40, fuel: 25, personal: 35 }

export function UpcomingPayments() {
  const { state, updateBill, addBill, removeBill, addPeriodicBill, updatePeriodicBill, removePeriodicBill } = useStore()
  const [window_, setWindow] = useState<UpcomingWindow>('week')
  const [allocation, setAllocation] = useState<Allocation>(DEFAULT_ALLOCATION)
  const liveRef = useRef<HTMLDivElement>(null)
  const [periodicFormMode, setPeriodicFormMode] = useState<'none' | 'add' | string>('none') // 'string' = editing that bill's id
  const [milestoneToast, setMilestoneToast] = useState<number | null>(null)

  const today = todayIso()
  const windowEnd = useMemo(() => addDaysIso(today, windowLengthDays(window_) - 1), [today, window_])
  const view = state.householdView

  const incomeInWindow = useMemo(() => (view === 'mimi' ? 0 : totalIncomeInWindow(today, windowEnd)), [today, windowEnd, view])
  const flatBillsInWindow = useMemo(() => totalBillsInWindow(state.bills, today, windowEnd, view), [state.bills, today, windowEnd, view])
  // Gas/Electricity are periodic bills now — Deep pays them in smoothed fortnightly
  // set-asides, so that smoothed contribution (not the lump due-date amount) is
  // what counts toward Live Funds Available here, to avoid double-counting.
  const periodicSmoothedInWindow = useMemo(
    () => totalPeriodicSmoothedInWindow(state.periodicBills, today, windowEnd, today, view),
    [state.periodicBills, today, windowEnd, view]
  )
  const sinkingFundsInWindow = useMemo(
    () => totalSinkingFundsSmoothedInWindow(state.sinkingFunds, today, windowEnd, today),
    [state.sinkingFunds, today, windowEnd]
  )
  const goalsFundedInWindow = useMemo(() => state.savingsGoals.reduce((s, g) => s + g.fundedThisPeriod, 0), [state.savingsGoals])
  const billsInWindow = useMemo(
    () => Math.round((flatBillsInWindow + periodicSmoothedInWindow + sinkingFundsInWindow + goalsFundedInWindow) * 100) / 100,
    [flatBillsInWindow, periodicSmoothedInWindow, sinkingFundsInWindow, goalsFundedInWindow]
  )
  const hsbc = state.accounts.find((a) => a.id === 'hsbc')?.value ?? 0
  const overdraft = state.accounts.find((a) => a.id === 'overdraft')?.value ?? 0

  const liveFundsAvailable = useMemo(
    () => Math.round((hsbc + overdraft + incomeInWindow - billsInWindow) * 100) / 100,
    [hsbc, overdraft, incomeInWindow, billsInWindow]
  )
  const isOverspent = liveFundsAvailable < 0

  const foodAmount = (liveFundsAvailable * allocation.food) / 100
  const fuelAmount = (liveFundsAvailable * allocation.fuel) / 100
  const personalAmount = (liveFundsAvailable * allocation.personal) / 100

  // GSAP entrance for the hero card, a "shockwave" burst on going negative,
  // and a real confetti celebration the moment it crosses BACK to positive.
  const wasOverspent = useRef(isOverspent)
  const hasMounted = useRef(false)
  useEffect(() => {
    if (!liveRef.current) return
    if (isOverspent && !wasOverspent.current) {
      gsap.fromTo(liveRef.current, { scale: 1 }, { scale: 1.04, duration: 0.18, yoyo: true, repeat: 3, ease: 'power1.inOut' })
    }
    if (!isOverspent && wasOverspent.current && hasMounted.current) {
      fireConfetti()
    }
    wasOverspent.current = isOverspent
    hasMounted.current = true
  }, [isOverspent])

  const priceChangedBills = state.bills.filter(isBillAmountChanged)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="gradient-heading text-2xl font-bold tracking-tight">Upcoming Payments</h2>
        <p className="text-sm text-white/50 mt-1">
          What's actually left for food, fuel and personal spending until pay day.
        </p>
      </div>

      {priceChangedBills.length > 0 && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200">
            {priceChangedBills.map((b) => (
              <div key={b.id}>
                <strong>{b.name}</strong> changed from {formatCurrency(b.previousAmount!)} to {formatCurrency(b.amount)}.
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Window toggle */}
      <SegmentedControl value={window_} onChange={setWindow} options={WINDOWS.map((w) => ({ value: w.id, label: w.label }))} />

      {/* HERO: LIVE FUNDS AVAILABLE — the centerpiece of the entire section */}
      <div
        ref={liveRef}
        className={cn(
          'relative rounded-3xl border-2 p-8 md:p-10 text-center overflow-hidden',
          isOverspent ? 'border-rose-500/60 overspend-alert' : 'border-cyan-400/40 shadow-[0_0_80px_-15px_rgba(34,211,238,0.5)]'
        )}
        style={{
          background: isOverspent
            ? 'radial-gradient(circle at 50% 0%, rgba(255,45,85,0.18), rgba(11,13,20,0.95))'
            : 'radial-gradient(circle at 50% 0%, rgba(34,211,238,0.14), rgba(11,13,20,0.95))',
        }}
      >
        <div
          className="absolute -inset-1 opacity-40 pointer-events-none"
          style={{
            background: isOverspent
              ? 'linear-gradient(120deg, transparent, rgba(255,45,85,0.35), transparent)'
              : 'linear-gradient(120deg, transparent, rgba(34,211,238,0.25), transparent, rgba(168,85,247,0.25), transparent)',
            animation: 'aurora-drift 9s ease-in-out infinite',
          }}
        />
        <div className="relative z-10">
          <p className={cn('text-xs font-bold uppercase tracking-[0.25em]', isOverspent ? 'text-rose-300' : 'text-cyan-300')}>
            Live Funds Available {view !== 'combined' && <span className="capitalize">— {view}'s view</span>}
          </p>
          <div
            className={cn(
              'mt-3 text-6xl md:text-8xl font-black tabular-nums tracking-tight',
              isOverspent
                ? 'text-rose-300 drop-shadow-[0_0_35px_rgba(255,45,85,0.6)]'
                : 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-200 to-purple-300 drop-shadow-[0_0_35px_rgba(34,211,238,0.35)]'
            )}
          >
            <CountUp value={liveFundsAvailable} prefix="$" decimals={2} duration={1.2} />
          </div>
          {isOverspent ? (
            <p className="mt-3 text-rose-200 font-semibold text-sm md:text-base animate-pulse">
              ⚠ OVERSPENT for this {window_} — funds run out before pay day. Cut spend or move money in.
            </p>
          ) : (
            <p className="mt-3 text-white/60 text-sm md:text-base">
              HSBC + Overdraft + income landing this {window_}, minus bills/funds due — what's actually free to spend.
            </p>
          )}
          {view === 'mimi' && (
            <p className="mt-1 text-[11px] text-white/35">No income data is tracked for Mimi — this view shows $0 income honestly rather than guessing.</p>
          )}

          {/* Food / Fuel / Personal breakdown — the whole point of this feature */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <AllocationTile label="Food Shopping" amount={foodAmount} pct={allocation.food} glowFrom="from-emerald-400" glowTo="to-cyan-400" onChange={(v) => setAllocation((a) => ({ ...a, food: v }))} />
            <AllocationTile label="Fuel" amount={fuelAmount} pct={allocation.fuel} glowFrom="from-amber-400" glowTo="to-orange-500" onChange={(v) => setAllocation((a) => ({ ...a, fuel: v }))} />
            <AllocationTile label="Personal" amount={personalAmount} pct={allocation.personal} glowFrom="from-purple-400" glowTo="to-pink-500" onChange={(v) => setAllocation((a) => ({ ...a, personal: v }))} />
          </div>
          <p className="mt-4 text-[11px] text-white/35 flex items-center justify-center gap-1">
            <Info className="w-3 h-3" /> Split is an editable estimate (sliders below) — adjust to match how you actually spend.
          </p>
        </div>
      </div>

      {milestoneToast && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-amber-200 text-sm streak-badge-pop">
          🔥 {milestoneToast}-day streak reached — staying on pace with your Food/Fuel/Personal allocation!
        </div>
      )}

      {/* Supporting stats: income / bills for the window */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard label={`Income — this ${window_}`} glow="success">
          <div className="mt-4 text-3xl font-bold text-emerald-300 tabular-nums">
            <CountUp value={incomeInWindow} prefix="$" />
          </div>
          <p className="text-xs text-white/45 mt-2">
            Real alternating pay pattern: $600 every Friday, +$500 fortnightly bonus on combined-pay Fridays (this Fri 11 Sep 2026 is combined).
          </p>
        </StatCard>
        <StatCard label={`Bills & Funds due — this ${window_} (estimate)`} glow="amber">
          <div className="mt-4 text-3xl font-bold text-amber-300 tabular-nums">
            <CountUp value={billsInWindow} prefix="$" />
          </div>
          <p className="text-xs text-white/45 mt-2">
            Flat bills (prorated) + Periodic Bills' smoothed set-asides + Sinking Funds' smoothed set-asides + Savings Goals funded this period.
          </p>
        </StatCard>
      </div>

      <CashFlowChart />

      <SpendPaceTracker
        allocation={{ food: foodAmount, fuel: fuelAmount, personal: personalAmount }}
        windowStart={today}
        windowEnd={windowEnd}
        onMilestone={(m) => { setMilestoneToast(m); fireConfetti() }}
      />

      <AccountsPanel />

      <SavingsGoalsSection />

      {/* Periodic bills — Gas & Electricity, projected-charge gauge + fortnightly smoothing */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white/85">Periodic Bills</h3>
          {periodicFormMode === 'none' && (
            <button
              onClick={() => setPeriodicFormMode('add')}
              className="flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
            >
              <Plus className="w-3 h-3" /> Add periodic bill
            </button>
          )}
        </div>

        {periodicFormMode === 'add' && (
          <div className="mb-4">
            <PeriodicBillForm
              onCancel={() => setPeriodicFormMode('none')}
              onSave={(values) => {
                addPeriodicBill(toPeriodicBill(values))
                setPeriodicFormMode('none')
              }}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {state.periodicBills.map((bill, i) =>
            periodicFormMode === bill.id ? (
              <PeriodicBillForm
                key={bill.id}
                existing={bill}
                onCancel={() => setPeriodicFormMode('none')}
                onSave={(values) => {
                  updatePeriodicBill(bill.id, toPeriodicBill(values, bill))
                  setPeriodicFormMode('none')
                }}
              />
            ) : (
              <PeriodicBillGauge
                key={bill.id}
                bill={bill}
                delay={0.05 * i}
                onEdit={() => setPeriodicFormMode(bill.id)}
                onRemove={() => removePeriodicBill(bill.id)}
              />
            )
          )}
        </div>
      </div>

      <SinkingFundsSection />

      {/* Installment plan trackers — GEM VISA cards + device repayment, filtered by household view */}
      <div>
        <h3 className="text-lg font-semibold text-white/85 mb-3">Installment Plans</h3>
        <div className="space-y-4">
          {state.creditCards.filter((c) => view === 'combined' || c.owner === view).map((card, i) => (
            <CreditCardAccountPanel key={card.id} card={card} delay={0.05 * i} />
          ))}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {state.deviceRepayments.map((device, i) => (
              <DeviceRepaymentCard key={device.id} device={device} delay={0.05 * i} />
            ))}
          </div>
        </div>
      </div>

      <HouseholdSplit />

      {/* Bills manager — every field editable */}
      <BillsManager bills={state.bills} onUpdate={updateBill} onAdd={addBill} onRemove={removeBill} />
    </div>
  )
}

/** Converts the add/edit form's plain values into a real PeriodicBill — preserves id/pendingBill/owner when editing an existing bill. */
function toPeriodicBill(values: PeriodicBillFormValues, existing?: PeriodicBill): PeriodicBill {
  return {
    id: existing?.id ?? `periodic-${Date.now()}`,
    name: values.name.trim(),
    pendingBill: existing?.pendingBill,
    gaugePeriodStart: values.gaugePeriodStart,
    gaugePeriodEnd: values.gaugePeriodEnd,
    projectedCharge: values.projectedCharge,
    inCredit: values.inCredit,
    creditAmount: values.inCredit ? values.creditAmount : 0,
    smoothingEnabled: values.smoothingEnabled,
    owner: existing?.owner ?? 'shared',
    sharedSplitDeepPercent: existing?.sharedSplitDeepPercent,
  }
}

function AllocationTile({ label, amount, pct, glowFrom, glowTo, onChange }: { label: string; amount: number; pct: number; glowFrom: string; glowTo: string; onChange: (v: number) => void }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/60">{label}</span>
        <span className="text-[10px] text-white/35">{pct}%</span>
      </div>
      <div className={cn('mt-2 text-2xl font-bold tabular-nums text-transparent bg-clip-text bg-gradient-to-r', glowFrom, glowTo)}>
        {formatCurrency(amount)}
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-3 accent-cyan-400"
      />
    </div>
  )
}

const FREQUENCIES: BillFrequency[] = ['weekly', 'fortnightly', 'monthly']

function BillsManager({ bills, onUpdate, onAdd, onRemove }: {
  bills: RecurringBill[]
  onUpdate: (id: string, patch: Partial<RecurringBill>) => void
  onAdd: (bill: RecurringBill) => void
  onRemove: (id: string) => void
}) {
  return (
    <StatCard label="Recurring Bills" glow="cyan" tilt={false}>
      <div className="mt-4 text-xs text-white/40">{bills.filter((b) => b.active).length} active bills — expand for full detail and editing.</div>
      <Disclosure title={`Show all ${bills.length} bills`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white/40 text-xs uppercase tracking-wide">
              <th className="pb-2 pr-2">Name</th>
              <th className="pb-2 pr-2">Amount</th>
              <th className="pb-2 pr-2">Frequency</th>
              <th className="pb-2 pr-2">Due day</th>
              <th className="pb-2 pr-2">Owner</th>
              <th className="pb-2 pr-2">Active</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id} className="border-t border-white/5">
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-1.5">
                    <BillIcon name={bill.name} className="w-3.5 h-3.5" />
                    <input
                      value={bill.name}
                      onChange={(e) => onUpdate(bill.id, { name: e.target.value })}
                      className="bg-transparent outline-none border-b border-transparent focus:border-cyan-400/50 w-28"
                    />
                    {bill.note && (
                      <span title={bill.note} className="shrink-0">
                        <Info className="w-3 h-3 text-white/30" aria-label={bill.note} />
                      </span>
                    )}
                    {isBillAmountChanged(bill) && (
                      <span title={`Changed from ${bill.previousAmount} to ${bill.amount}`} className="shrink-0">
                        <AlertTriangle className="w-3 h-3 text-amber-400" aria-label="Amount changed since last saved" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-1">
                    <span className="text-white/40">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={bill.amount}
                      onChange={(e) => onUpdate(bill.id, { amount: parseFloat(e.target.value) || 0 })}
                      className="bg-transparent outline-none border-b border-transparent focus:border-cyan-400/50 w-20 tabular-nums"
                    />
                  </div>
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={bill.frequency}
                    onChange={(e) => onUpdate(bill.id, { frequency: e.target.value as BillFrequency })}
                    className="bg-black/40 rounded px-2 py-1 text-xs outline-none border border-white/10"
                  >
                    {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={bill.dueDay}
                      onChange={(e) => onUpdate(bill.id, { dueDay: Number(e.target.value) || 1 })}
                      className="bg-transparent outline-none border-b border-transparent focus:border-cyan-400/50 w-10 tabular-nums"
                    />
                    {bill.dueDayIsEstimate && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        estimated
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={bill.owner}
                    onChange={(e) => onUpdate(bill.id, { owner: e.target.value as RecurringBill['owner'] })}
                    className="bg-black/40 rounded px-2 py-1 text-xs outline-none border border-white/10 capitalize"
                  >
                    <option value="shared">Shared</option>
                    <option value="deep">Deep</option>
                    <option value="mimi">Mimi</option>
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    checked={bill.active}
                    onChange={(e) => onUpdate(bill.id, { active: e.target.checked })}
                    className="accent-cyan-400 w-4 h-4"
                  />
                </td>
                <td className="py-2">
                  <button onClick={() => onRemove(bill.id)} className="text-white/30 hover:text-rose-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={() =>
            onAdd({
              id: `bill-${Date.now()}`,
              name: 'New bill',
              amount: 0,
              frequency: 'monthly',
              dueDay: 1,
              dueDayIsEstimate: true,
              category: 'other',
              active: true,
              owner: 'shared',
            })
          }
          className="mt-3 flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
        >
          <Plus className="w-3 h-3" /> Add bill
        </button>
      </div>
      </Disclosure>
    </StatCard>
  )
}
