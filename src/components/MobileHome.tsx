import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Menu, Plus, X, ArrowDownLeft, ArrowUpRight, Wallet, ChevronRight, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { useStore } from '@/lib/store'
import { CountUp } from './CountUp'
import { BillIcon } from './BillIcons'
import { computeLiveFunds, applyQuickEntry, undoQuickEntry, type QuickEntry, type QuickCategory } from '@/lib/liveFunds'
import { addDaysIso, daysBetweenIso, incomeOnDate, nextMonthlyDueDate, nzNetIncome, auNetIncome, monthlyEquivalent, generateInsights } from '@/lib/logic'
import { cn, formatCurrency, formatShortDate, todayIso } from '@/lib/utils'

const INSIGHT_TAB: Record<string, string> = { overspend: 'budgets', 'low-savings-rate': 'networth', 'healthy-savings-rate': 'networth', 'high-fixed-costs': 'upcoming', 'high-interest-debt': 'debts', 'no-savings-buffer': 'networth' }

/**
 * Phone landing screen (< 768px). Every number comes from existing logic: Live Funds from the
 * shared computeLiveFunds() (same function Upcoming Payments uses), insights from
 * generateInsights() (same call Dashboard makes). Nothing here recomputes tax or bills maths.
 */
export function MobileHome({ onOpenMenu, onNavigate }: { onOpenMenu: () => void; onNavigate: (id: string) => void }) {
  const { state, setState } = useStore()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [undo, setUndo] = useState<{ entry: QuickEntry; id: string; msg: string } | null>(null)
  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), 4000)
    return () => clearTimeout(t)
  }, [undo])
  const today = todayIso()
  const view = state.householdView

  const lf = useMemo(() => computeLiveFunds(state, today, 'week', view), [state, today, view])
  const isOverspent = lf.liveFundsAvailable < 0

  const events = useMemo(() => {
    const out: { key: string; date: string; label: string; amount: number; kind: 'bill' | 'payday' }[] = []
    const end = addDaysIso(today, 6)
    for (const b of state.bills) {
      if (!b.active || b.frequency !== 'monthly') continue
      const d = nextMonthlyDueDate(b.dueDay, today)
      if (d >= today && d <= end) out.push({ key: `b-${b.id}`, date: d, label: b.name, amount: -b.amount, kind: 'bill' })
    }
    if (view !== 'mimi') {
      for (let i = 0; i < 7; i++) {
        const d = addDaysIso(today, i)
        const inc = incomeOnDate(d, state.incomeAnchor)
        if (inc > 0) out.push({ key: `p-${d}`, date: d, label: 'Payday', amount: inc, kind: 'payday' })
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date))
  }, [state.bills, state.incomeAnchor, today, view])

  const nextBills = useMemo(() => state.bills
    .filter((b) => b.active && b.frequency === 'monthly')
    .map((b) => { const d = nextMonthlyDueDate(b.dueDay, today); return { id: b.id, name: b.name, amount: b.amount, date: d, days: daysBetweenIso(today, d) } })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3), [state.bills, today])

  const chips = useMemo(() => {
    const net = state.country === 'NZ' ? nzNetIncome(state.grossAnnualIncome) : auNetIncome(state.grossAnnualIncome)
    const monthlyNet = net.net / 12
    const monthlyBills = state.bills.filter((b) => b.active).reduce((s, b) => s + monthlyEquivalent(b.amount, b.frequency), 0)
    const savings = state.accounts.find((a) => a.id === 'savings')?.value ?? 0
    const rank = { critical: 0, warning: 1, info: 2 } as const
    return generateInsights({ monthlyIncome: monthlyNet, monthlyExpenses: monthlyBills, bills: state.bills, debts: state.debts, savingsBalance: savings })
      .sort((a, b) => rank[a.severity] - rank[b.severity])
      .slice(0, 3)
  }, [state.bills, state.debts, state.accounts, state.country, state.grossAnnualIncome])

  const total = lf.incomeInWindow + Math.max(0, lf.hsbc + lf.overdraft)
  const billsPct = total > 0 ? Math.min(100, (lf.billsInWindow / total) * 100) : 100

  return (
    <div className="space-y-5 pb-28">
      <div className="flex items-center justify-between">
        <h2 className="gradient-heading text-2xl font-bold tracking-tight">Home</h2>
        <button type="button" onClick={onOpenMenu} aria-label="Open all sections" className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 min-h-11 text-sm font-semibold text-white">
          <Menu className="w-4 h-4" /> Menu
        </button>
      </div>

      <section aria-label="Live Funds Available" className={cn('ux-glass border border-white/10 p-5', isOverspent && 'overspend-alert')}>
        <div className="flex items-center gap-2 text-sm font-semibold text-white/70"><Wallet className="w-4 h-4" /> Free to spend · 7 days</div>
        <div className={cn('mt-2 text-5xl font-black tabular-nums break-words', isOverspent ? 'text-rose-300' : 'ux-hero-number')} data-testid="live-funds">
          <CountUp value={lf.liveFundsAvailable} prefix="$" decimals={2} duration={1} />
        </div>
        {isOverspent && <p className="mt-1 text-sm font-semibold text-rose-300">Overspent — bills due this week exceed what you have.</p>}
        <div className="mt-4" role="img" aria-label={`Bills due this window ${formatCurrency(lf.billsInWindow)} of ${formatCurrency(total)} available`}>
          <div className="h-3 rounded-full bg-white/10 overflow-hidden flex">
            <div className={cn('h-full bg-gradient-to-r', billsPct > 90 ? 'from-orange-500 to-rose-500' : 'from-amber-400 to-orange-500')} style={{ width: `${billsPct}%` }} />
          </div>
          <div className="mt-2 flex justify-between gap-2 text-sm text-white/70">
            <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1.5" />Bills set aside (est.) {formatCurrency(lf.billsInWindow)}</span>
            <span className="text-right">Money in {formatCurrency(lf.hsbc + lf.overdraft + lf.incomeInWindow)}</span>
          </div>
          <p className="mt-1 text-xs text-white/50">{Math.round(billsPct)}% of your money is set aside for bills (a daily share of monthly bills, not just what falls due this week).</p>
        </div>
      </section>

      <section aria-label="Coming up">
        <h3 className="text-base font-bold text-white mb-2">Coming up</h3>
        {events.length === 0 ? (
          <div className="ux-empty ux-glass border border-white/10">No bills or paydays in the next 7 days.</div>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.key}>
                <button type="button" onClick={() => onNavigate('upcoming')} className="w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 min-h-14 text-left">
                  <span className="ux-icon-chip" style={{ ['--chip-color' as string]: e.kind === 'payday' ? '#34d399' : '#fbbf24' }}>
                    {e.kind === 'payday' ? <ArrowDownLeft className="w-5 h-5" /> : <BillIcon name={e.label} className="w-5 h-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-white truncate">{e.label}</span>
                    <span className="block text-sm text-white/65">{e.date === today ? 'Today' : formatShortDate(e.date)}</span>
                  </span>
                  <span className={cn('text-base font-bold tabular-nums', e.amount > 0 ? 'text-emerald-300' : 'text-amber-200')}>
                    {e.amount > 0 ? '+' : '−'}{formatCurrency(Math.abs(e.amount))}
                  </span>
                  <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Next bills">
        <h3 className="text-base font-bold text-white mb-2">Next bills</h3>
        {nextBills.length === 0 ? (
          <div className="ux-empty ux-glass border border-white/10">No active monthly bills yet. Add one under Upcoming.</div>
        ) : (
          <ul className="space-y-2">
            {nextBills.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => onNavigate('upcoming')} className="w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 min-h-14 text-left">
                  <span className="ux-icon-chip" style={{ ['--chip-color' as string]: '#fbbf24' }}><BillIcon name={b.name} className="w-5 h-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-white truncate">{b.name}</span>
                    <span className="block text-sm text-white/65">{b.days === 0 ? 'Due today' : b.days === 1 ? 'Due in 1 day' : `Due in ${b.days} days`} · {formatShortDate(b.date)}</span>
                  </span>
                  <span className="text-base font-bold tabular-nums text-amber-200">{formatCurrency(b.amount)}</span>
                  <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Insights">
        <h3 className="text-base font-bold text-white mb-2">Worth knowing</h3>
        <div className="-mx-4 px-4 flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1" style={{ scrollPaddingLeft: '1rem' }}>
          {chips.map((c, i) => {
            const hot = i === 0 && c.severity !== 'info'
            const Icon = hot ? AlertTriangle : c.severity === 'info' ? CheckCircle2 : Info
            return (
              <button key={c.id} type="button" onClick={() => onNavigate(INSIGHT_TAB[c.id] ?? 'dashboard')}
                className={cn('snap-start shrink-0 w-[15rem] flex items-start gap-2 rounded-2xl border px-3 py-2.5 min-h-14 text-left text-sm', hot ? (c.severity === 'critical' ? 'border-rose-300/50 bg-rose-400/10 text-rose-100' : 'border-amber-300/50 bg-amber-400/10 text-amber-100') : 'border-white/10 bg-white/[0.04] text-white/85')}>
                <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', hot ? (c.severity === 'critical' ? 'text-rose-300' : 'text-amber-300') : c.severity === 'info' ? 'text-emerald-300' : 'text-white/50')} />
                <span className="min-w-0 line-clamp-2">{c.message}</span>
              </button>
            )
          })}
          {chips.length === 0 && <div className="w-full ux-empty ux-glass border border-white/10"><Info className="w-4 h-4" />No insights yet — add bills, debts and balances.</div>}
        </div>
      </section>

      {createPortal(<button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label="Add an expense or income"
        className="fixed right-4 z-[55] flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 px-6 min-h-14 text-base font-extrabold text-black shadow-[0_8px_30px_-6px_rgba(34,211,238,0.6)]"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <Plus className="w-5 h-5" strokeWidth={3} /> Add
      </button>, document.body)}

      {sheetOpen && createPortal(<AddSheet today={today} onClose={() => setSheetOpen(false)} onSave={(e) => {
        const id = `quick-${Date.now()}`
        setState((s) => applyQuickEntry(s, e, today, id))
        setSheetOpen(false)
        setUndo({ entry: e, id, msg: `Added ${e.kind === 'expense' ? '-' : '+'}$${e.amount} ${e.description || (e.kind === 'expense' ? 'Quick expense' : 'Quick income')}` })
      }} />, document.body)}
      {undo && createPortal(
        <div role="status" aria-live="polite" className="fixed inset-x-4 z-[75] flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/30 bg-[#0b0d14] px-4 min-h-14 text-base text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)]" style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}>
          <span className="min-w-0 truncate">{undo.msg}</span>
          <button type="button" onClick={() => { setState((s) => undoQuickEntry(s, undo.entry, today, undo.id)); setUndo(null) }} className="shrink-0 min-h-11 px-2 font-bold text-cyan-300">Undo</button>
        </div>, document.body)}
    </div>
  )
}

function AddSheet({ today, onClose, onSave }: { today: string; onClose: () => void; onSave: (e: QuickEntry) => void }) {
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState(today)
  const [cat, setCat] = useState<QuickCategory>('personal')
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  const amt = parseFloat(amount)
  const valid = amt > 0
  const field = 'w-full rounded-xl border border-white/15 bg-black/40 px-3 min-h-12 text-base text-white outline-none focus:border-cyan-400/70'
  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Add entry">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-white/15 bg-[#0b0d14] p-5 space-y-4" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Add entry</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Type">
          {(['expense', 'income'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
              className={cn('flex items-center justify-center gap-2 rounded-xl min-h-12 text-base font-bold border', kind === k ? (k === 'expense' ? 'bg-rose-400/20 border-rose-300 text-rose-100' : 'bg-emerald-400/20 border-emerald-300 text-emerald-100') : 'border-white/15 text-white/70')}>
              {k === 'expense' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}{k === 'expense' ? 'Expense' : 'Income'}
            </button>
          ))}
        </div>
        {kind === 'expense' && (
          <div role="group" aria-label="Category" className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
            {([['food', 'Food'], ['fuel', 'Fuel'], ['personal', 'Personal'], ['general', 'General'], ['extraUsage', 'Extra usage']] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)}
                className={cn('shrink-0 rounded-full border px-4 min-h-11 text-sm font-semibold', cat === k ? 'bg-cyan-400/20 border-cyan-300 text-cyan-100' : 'border-white/15 text-white/70')}>{l}</button>
            ))}
          </div>
        )}
        <label className="block text-sm font-semibold text-white/80">Amount ($)
          <input className={cn(field, 'mt-1 text-2xl font-bold tabular-nums')} type="number" inputMode="decimal" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </label>
        <label className="block text-sm font-semibold text-white/80">Description
          <input className={cn(field, 'mt-1')} type="text" placeholder={kind === 'expense' ? 'e.g. Lunch' : 'e.g. Refund'} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </label>
        <label className="block text-sm font-semibold text-white/80">Date
          <input className={cn(field, 'mt-1')} type="date" value={date} onChange={(e) => setDate(e.target.value || today)} />
        </label>
        {date > today && <p className="text-sm text-white/60">Future date: goes into the forecast only; Live Funds changes when the day arrives.</p>}
        <button type="button" disabled={!valid} onClick={() => onSave({ kind, amount: amt, description: desc.trim(), date, category: kind === 'expense' ? cat : undefined })}
          className="w-full rounded-xl min-h-14 text-base font-extrabold text-black bg-gradient-to-r from-cyan-400 to-purple-500 disabled:opacity-40">
          Save {kind}
        </button>
      </div>
    </div>
  )
}
