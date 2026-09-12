import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { addDaysIso, totalBillsInWindow, totalIncomeInWindow, totalPeriodicSmoothedInWindow, totalSinkingFundsSmoothedInWindow, windowLengthDays, isBillAmountChanged, nextMonthlyDueDate, resolvePaymentMethod, dueTodayBills } from '@/lib/logic'
import { cn, formatCurrency, todayIso, formatShortDate } from '@/lib/utils'
import type { UpcomingWindow, RecurringBill, BillFrequency, PeriodicBill } from '@/lib/types'
import { Plus, Trash2, Info, AlertTriangle, ChevronDown, Wallet, PiggyBank, RefreshCw, HandCoins } from 'lucide-react'
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
import { DueBadge } from './DueBadge'
import { useToast } from './Toast'
import { useUndoableDelete } from '@/lib/useUndoableDelete'
import { fireConfetti, fireStreakConfetti } from '@/lib/confetti'
import { chimeBillPaid, chimeStreakMilestone, chimePaydayLanding } from '@/lib/sound'

const WINDOWS: { id: UpcomingWindow; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'fortnight', label: 'Fortnight' },
  { id: 'month', label: 'Month' },
]

interface Allocation { food: number; fuel: number; personal: number }
const DEFAULT_ALLOCATION: Allocation = { food: 40, fuel: 25, personal: 35 }

/** Sub-allocation WITHIN Personal's total — percentages of Personal's own amount, not new
 * top-level slices of Live Funds Available. Holiday savings deliberately does NOT get a 5th
 * slot here — it's wired into Savings Goals below instead (see the note in PersonalAllocationTile). */
interface PersonalSplit { takeaways: number; entertainment: number; clothing: number; personalItems: number }
const DEFAULT_PERSONAL_SPLIT: PersonalSplit = { takeaways: 30, entertainment: 25, clothing: 20, personalItems: 25 }

export function UpcomingPayments() {
  const { state, updateBill, addBill, removeBill, addPeriodicBill, updatePeriodicBill, removePeriodicBill, addDeviceRepayment, updateDeviceRepayment, removeDeviceRepayment } = useStore()
  const withUndo = useUndoableDelete()
  const [window_, setWindow] = useState<UpcomingWindow>('week')
  const [allocation, setAllocation] = useState<Allocation>(DEFAULT_ALLOCATION)
  const [personalOpen, setPersonalOpen] = useState(false)
  const [personalSplit, setPersonalSplit] = useState<PersonalSplit>(DEFAULT_PERSONAL_SPLIT)
  const [billsView, setBillsView] = useState<'snapshot' | 'detailed'>('snapshot')
  const [highlightedBillIds, setHighlightedBillIds] = useState<Set<string>>(new Set())
  const liveRef = useRef<HTMLDivElement>(null)
  const highlightTimerRef = useRef<number | null>(null)
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
      chimePaydayLanding(state.soundEnabled)
    }
    wasOverspent.current = isOverspent
    hasMounted.current = true
  }, [isOverspent])

  const priceChangedBills = state.bills.filter(isBillAmountChanged)

  // Real UX fix: the Upcoming Payments nav badge previously did nothing perceptible when
  // clicked while already on this tab (App.tsx's goTo() is a no-op for the current tab).
  // Clicking it now dispatches this event regardless of which tab you're on — this listens
  // for it, switches to Snapshot (the view that actually shows individual bills at a glance),
  // scrolls the first due-today card into view, and flashes ALL of today's due bills briefly
  // so they're unmistakable even if more than one is due.
  useEffect(() => {
    function onHighlightDueBills() {
      const dueToday = dueTodayBills(state.bills, todayIso())
      if (dueToday.length === 0) return
      setBillsView('snapshot')
      setHighlightedBillIds(new Set(dueToday.map((b) => b.id)))
      requestAnimationFrame(() => {
        // NOT `behavior: 'smooth'` — confirmed live during testing that it can silently no-op
        // (scroll position never moves, no error) in at least one real browser environment.
        // The whole point of this fix is that the click visibly DOES something; the glow pulse
        // below still gives it a soft landing without betting the actual scroll on smooth-scroll
        // support being reliable everywhere.
        document.getElementById(`bill-snapshot-${dueToday[0].id}`)?.scrollIntoView({ block: 'center' })
      })
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = window.setTimeout(() => setHighlightedBillIds(new Set()), 1800)
    }
    window.addEventListener('clarity:highlight-due-bills', onHighlightDueBills)
    return () => {
      window.removeEventListener('clarity:highlight-due-bills', onHighlightDueBills)
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current)
    }
  }, [state.bills])

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
        {/* #47 reduced-motion audit fix: this animation was previously set via inline
            style.animation, which CSS media queries can never override (inline always wins
            over stylesheet rules regardless of specificity) — a real gap `prefers-reduced-motion`
            couldn't reach. Moved to a real class so the shared reduced-motion rule applies. */}
        <div
          className="aurora-bg absolute -inset-1 opacity-40 pointer-events-none"
          style={{
            background: isOverspent
              ? 'linear-gradient(120deg, transparent, rgba(255,45,85,0.35), transparent)'
              : 'linear-gradient(120deg, transparent, rgba(34,211,238,0.25), transparent, rgba(168,85,247,0.25), transparent)',
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
            <PersonalAllocationTile
              amount={personalAmount}
              pct={allocation.personal}
              onChange={(v) => setAllocation((a) => ({ ...a, personal: v }))}
              open={personalOpen}
              onToggleOpen={() => setPersonalOpen((o) => !o)}
              split={personalSplit}
              onSplitChange={setPersonalSplit}
            />
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
        onMilestone={(m) => { setMilestoneToast(m); fireStreakConfetti(); chimeStreakMilestone(state.soundEnabled) }}
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
                onRemove={() => withUndo(`${bill.name} removed`, () => removePeriodicBill(bill.id))}
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
              <DeviceRepaymentCard
                key={device.id}
                device={device}
                delay={0.05 * i}
                onUpdate={(patch) => updateDeviceRepayment(device.id, patch)}
                onRemove={() => withUndo(`${device.name} removed`, () => removeDeviceRepayment(device.id))}
              />
            ))}
          </div>
          {/* Round 21, item #2 — this section had cards but no way to add a new one; every device
              repayment was seeded once and permanently stuck at the starting seed data. */}
          <button
            onClick={() =>
              addDeviceRepayment({
                id: `device-${Date.now()}`,
                name: 'New device',
                monthlyAmount: 0,
                remaining: 0,
                paymentsTotal: 12,
                paymentsRemaining: 12,
                owner: 'shared',
              })
            }
            className="flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
          >
            <Plus className="w-3 h-3" /> Add device repayment
          </button>
        </div>
      </div>

      <HouseholdSplit />

      {/* Bills manager — Snapshot (default, fast-scan cards) or Detailed (every field editable) */}
      <BillsManager
        bills={state.bills}
        onUpdate={updateBill}
        onAdd={addBill}
        onRemove={removeBill}
        view={billsView}
        onViewChange={setBillsView}
        liveFundsAvailable={liveFundsAvailable}
        isOverspent={isOverspent}
        window_={window_}
        highlightedBillIds={highlightedBillIds}
      />
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

const PERSONAL_SUB_ITEMS: { key: keyof PersonalSplit; label: string }[] = [
  { key: 'takeaways', label: 'Takeaways' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'clothing', label: 'Clothing' },
  { key: 'personalItems', label: 'Personal Items' },
]

/**
 * Personal tile, extended with a click-to-expand breakdown across Takeaways/
 * Entertainment/Clothing/Personal Items — each a % OF Personal's own amount
 * (not a new top-level slice of Live Funds Available), per the locked-in
 * design decision. Still 3 top-level tiles total; this just makes the third
 * one disclose further detail rather than adding a 4th/5th tile.
 *
 * Holiday Savings deliberately has NO slot here — a note below the sliders
 * points at Savings Goals instead, so it's still easy to find (heuristic #6,
 * recognition over recall) without duplicating allocation logic.
 */
function PersonalAllocationTile({
  amount,
  pct,
  onChange,
  open,
  onToggleOpen,
  split,
  onSplitChange,
}: {
  amount: number
  pct: number
  onChange: (v: number) => void
  open: boolean
  onToggleOpen: () => void
  split: PersonalSplit
  onSplitChange: (s: PersonalSplit) => void
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <button type="button" onClick={onToggleOpen} className="w-full flex items-center justify-between text-left" aria-expanded={open}>
        <span className="text-xs font-semibold uppercase tracking-wide text-white/60 flex items-center gap-1.5">
          Personal
          <ChevronDown className={cn('w-3 h-3 transition-transform text-white/35', open && 'rotate-180')} />
        </span>
        <span className="text-[10px] text-white/35">{pct}%</span>
      </button>
      <div className="mt-2 text-2xl font-bold tabular-nums text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
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

      <div className="disclosure-body" style={{ maxHeight: open ? 400 : 0, opacity: open ? 1 : 0 }}>
        <div className="mt-4 pt-3 border-t border-white/10 space-y-3">
          {PERSONAL_SUB_ITEMS.map((item) => {
            const subAmount = (amount * split[item.key]) / 100
            return (
              <div key={item.key}>
                <div className="flex items-center justify-between text-[11px] text-white/50">
                  <span>{item.label}</span>
                  <span className="tabular-nums text-white/70">{formatCurrency(subAmount)} · {split[item.key]}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={split[item.key]}
                  onChange={(e) => onSplitChange({ ...split, [item.key]: Number(e.target.value) })}
                  className="w-full mt-1 accent-pink-400"
                />
              </div>
            )
          })}
          <p className="pt-1 text-[10px] text-white/35 flex items-start gap-1">
            <PiggyBank className="w-3 h-3 shrink-0 mt-0.5" />
            Saving for a holiday? That's tracked as a Savings Goal, not a Personal slice — add it in Savings Goals below.
          </p>
        </div>
      </div>
    </div>
  )
}

const FREQUENCIES: BillFrequency[] = ['weekly', 'fortnightly', 'monthly']

/** #8/#19 — real per-instance paid toggle, backed by a real PaymentRecord (amount + date, not just a boolean), with the SVG draw-on checkmark and a toast with Undo. */
function PaidToggle({ billId, billName, dueDateIso, amount }: { billId: string; billName: string; dueDateIso: string; amount: number }) {
  const { state, recordPayment, deletePaymentRecord } = useStore()
  const { showToast } = useToast()
  const existing = state.paymentRecords.find((r) => r.targetId === billId && r.dueDateIso === dueDateIso)
  const paid = !!existing

  const toggle = () => {
    if (existing) {
      deletePaymentRecord(existing.id)
      showToast(`${billName} marked unpaid`, { tone: 'info' })
    } else {
      const id = recordPayment({ targetType: 'recurringBill', targetId: billId, targetLabel: billName, amount, date: todayIso(), dueDateIso })
      chimeBillPaid(state.soundEnabled)
      showToast(`${billName} marked paid — $${amount.toFixed(2)} recorded for ${formatShortDate(dueDateIso)}`, { tone: 'success', actionLabel: 'Undo', onAction: () => deletePaymentRecord(id) })
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={paid ? `Paid for ${dueDateIso} — click to undo` : `Mark paid for ${dueDateIso}`}
      className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${paid ? 'bg-emerald-500/20 border-emerald-400/50' : 'border-white/15 hover:border-cyan-400/40'}`}
    >
      {paid && (
        <svg key={dueDateIso} className="checkmark-draw w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none">
          <path d="M4 12l6 6L20 6" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

function BillsManager({ bills, onUpdate, onAdd, onRemove, view, onViewChange, liveFundsAvailable, isOverspent, window_, highlightedBillIds }: {
  bills: RecurringBill[]
  onUpdate: (id: string, patch: Partial<RecurringBill>) => void
  onAdd: (bill: RecurringBill) => void
  onRemove: (id: string) => void
  view: 'snapshot' | 'detailed'
  onViewChange: (v: 'snapshot' | 'detailed') => void
  liveFundsAvailable: number
  isOverspent: boolean
  window_: UpcomingWindow
  highlightedBillIds: Set<string>
}) {
  const withUndo = useUndoableDelete()
  const activeBills = bills.filter((b) => b.active)
  // tilt off: dense multi-column editable table — kept from the app-wide mouse-tilt audit.
  return (
    <StatCard label="Recurring Bills" glow="cyan" tilt={false}>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-white/40">{activeBills.length} active bills</div>
        {/* Same Live Funds Available figure as the hero card above — reused, not
            recomputed, so it can never drift from it. A second, quieter surface
            of the number right where the bills themselves are being reviewed. */}
        <div className="flex items-center gap-1.5 text-xs">
          <Wallet className={cn('w-3.5 h-3.5', isOverspent ? 'text-rose-300' : 'text-cyan-300')} />
          <span className="text-white/40">Live funds this {window_}:</span>
          <span className={cn('font-semibold tabular-nums', isOverspent ? 'text-rose-300' : 'text-cyan-300')}>
            {formatCurrency(liveFundsAvailable)}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <SegmentedControl
          size="sm"
          value={view}
          onChange={onViewChange}
          options={[
            { value: 'snapshot', label: 'Snapshot' },
            { value: 'detailed', label: 'Detailed' },
          ]}
        />
      </div>

      {view === 'snapshot' ? (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {activeBills.length === 0 && <p className="text-sm text-white/35 col-span-full">No active bills.</p>}
          {activeBills.map((bill, i) => (
            <BillSnapshotCard key={bill.id} bill={bill} delay={i * 0.04} highlighted={highlightedBillIds.has(bill.id)} />
          ))}
        </div>
      ) : (
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white/40 text-xs uppercase tracking-wide">
              <th className="pb-2 pr-2">Name</th>
              <th className="pb-2 pr-2">Amount</th>
              <th className="pb-2 pr-2">Frequency</th>
              <th className="pb-2 pr-2">Payment</th>
              <th className="pb-2 pr-2">Due day</th>
              <th className="pb-2 pr-2">Owner</th>
              <th className="pb-2 pr-2">Active</th>
              <th className="pb-2 pr-2">Paid</th>
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
                  <button
                    type="button"
                    title="Click to switch between direct debit and manual"
                    onClick={() => onUpdate(bill.id, { paymentMethod: resolvePaymentMethod(bill) === 'direct-debit' ? 'manual' : 'direct-debit' })}
                  >
                    <PaymentMethodBadge method={resolvePaymentMethod(bill)} />
                  </button>
                </td>
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
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
                    {bill.active && bill.frequency === 'monthly' && (
                      <DueBadge dueDateIso={nextMonthlyDueDate(bill.dueDay, todayIso())} />
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
                <td className="py-2 pr-2">
                  {bill.active && bill.frequency === 'monthly' ? (
                    <PaidToggle billId={bill.id} billName={bill.name} dueDateIso={nextMonthlyDueDate(bill.dueDay, todayIso())} amount={bill.amount} />
                  ) : (
                    <span className="text-white/20 text-xs">—</span>
                  )}
                </td>
                <td className="py-2">
                  <button onClick={() => withUndo(`${bill.name} removed`, () => onRemove(bill.id))} className="text-white/30 hover:text-rose-400">
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
      )}
    </StatCard>
  )
}

/**
 * Direct-debit vs manual-pay — a real distinction Deep lives with, not an arbitrary category
 * (ease-of-use standard, heuristic #2). Direct debit reads as reassuring/passive (taken
 * automatically, nothing to do); manual reads as actionable (he has to go pay it). One shared
 * component so Snapshot and Detailed can never drift into showing this two different ways.
 */
function PaymentMethodBadge({ method }: { method: 'direct-debit' | 'manual' }) {
  if (method === 'direct-debit') {
    return (
      <span
        title="Direct debit — taken automatically. No action needed unless funds are short."
        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium whitespace-nowrap bg-cyan-500/10 text-cyan-300 border-cyan-400/30"
      >
        <RefreshCw className="w-2.5 h-2.5" /> Auto-pay
      </span>
    )
  }
  return (
    <span
      title="You pay this yourself, by the due date — it won't be taken automatically."
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium whitespace-nowrap bg-violet-500/10 text-violet-300 border-violet-400/30"
    >
      <HandCoins className="w-2.5 h-2.5" /> You pay this
    </span>
  )
}

/** Snapshot card: icon, name, amount, a due-soon badge (monthly bills only — same
 * existing due-date-known scope as the detailed table's PaidToggle/DueBadge; weekly/
 * fortnightly bills have no confirmed single due-date to badge against), and the
 * direct-debit/manual distinction. `id` is a stable DOM anchor so the Upcoming Payments
 * nav badge can scrollIntoView + flash a specific due-today card even when already on
 * this tab (see App.tsx's `clarity:highlight-due-bills` dispatch). */
function BillSnapshotCard({ bill, delay, highlighted }: { bill: RecurringBill; delay: number; highlighted: boolean }) {
  return (
    <div
      id={`bill-snapshot-${bill.id}`}
      className={cn(
        'bill-snapshot-in rounded-xl border border-white/10 bg-black/30 p-3 flex flex-col gap-2',
        highlighted && 'bill-highlight-pulse'
      )}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center gap-2">
        <BillIcon name={bill.name} className="w-4 h-4 shrink-0" />
        <span className="text-sm text-white/85 truncate">{bill.name}</span>
      </div>
      <span className="text-lg font-bold tabular-nums text-white/90">{formatCurrency(bill.amount)}</span>
      {bill.frequency === 'monthly' ? (
        <DueBadge dueDateIso={nextMonthlyDueDate(bill.dueDay, todayIso())} />
      ) : (
        <span className="text-[10px] text-white/35 capitalize">{bill.frequency}</span>
      )}
      <PaymentMethodBadge method={resolvePaymentMethod(bill)} />
    </div>
  )
}
