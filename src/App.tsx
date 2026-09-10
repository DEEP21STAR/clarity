import { useEffect, useMemo, useRef, useState } from 'react'
import { StoreProvider, useStore } from '@/lib/store'
import { BootSequence } from './components/BootSequence'
import { Dashboard } from './components/Dashboard'
import { UpcomingPayments } from './components/UpcomingPayments'
import { Transactions } from './components/Transactions'
import { Budgets } from './components/Budgets'
import { Debts } from './components/Debts'
import { NetWorth } from './components/NetWorth'
import { BillCalendar } from './components/BillCalendar'
import { ShoppingExpenses } from './components/ShoppingExpenses'
import { Tools } from './components/Tools'
import { PinGate } from './components/PinGate'
import { AmbientBackground } from './components/AmbientBackground'
import { CommandPalette, type PaletteCommand } from './components/CommandPalette'
import { SegmentedControl } from './components/SegmentedControl'
import { ToastProvider, useToast } from './components/Toast'
import { NotificationBell } from './components/NotificationBell'
import { CursorGlow } from './components/CursorGlow'
import { computeCurrentHealthScore, calcNetWorth, nextMonthlyDueDate } from '@/lib/logic'
import { cn, formatCurrency, todayIso } from '@/lib/utils'
import { captureThumbnail } from '@/lib/thumbnailCache'
import {
  LayoutDashboard, CalendarClock, Receipt, PieChart, CreditCard, ShoppingCart, Wrench, TrendingUp, CalendarDays, Command, WifiOff, Check,
} from 'lucide-react'

type TabId = 'dashboard' | 'upcoming' | 'transactions' | 'budgets' | 'debts' | 'networth' | 'calendar' | 'shopping' | 'tools'

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'upcoming', label: 'Upcoming Payments', icon: CalendarClock },
  { id: 'networth', label: 'Net Worth', icon: TrendingUp },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'budgets', label: 'Budgets', icon: PieChart },
  { id: 'debts', label: 'Debts', icon: CreditCard },
  { id: 'shopping', label: 'Shopping & Expenses', icon: ShoppingCart },
  { id: 'tools', label: 'Tools', icon: Wrench },
]

/** Subtle time-of-day ambient tint — cooler in the morning, warmer in the evening. Same idea as the time-of-day theming already used on Deep's Omarchy desktop. */
function useTimeOfDayTint(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 11) return 'tint-morning'
  if (hour >= 17 && hour < 23) return 'tint-evening'
  return ''
}

function AppContent() {
  const { state, setHouseholdView } = useStore()
  const { showToast } = useToast()
  const [tab, setTab] = useState<TabId>('upcoming')
  const mainRef = useRef<HTMLDivElement>(null)
  const tint = useTimeOfDayTint()
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [justSaved, setJustSaved] = useState(false)

  // #22 — feeds the ambient particle background's calm/troubled reaction; same shared
  // formula the Dashboard headline and daily snapshot use (computeCurrentHealthScore).
  const healthScore = useMemo(
    () => computeCurrentHealthScore({
      bills: state.bills, creditCards: state.creditCards, debts: state.debts,
      accounts: state.accounts, grossAnnualIncome: state.grossAnnualIncome, country: state.country,
    }).score,
    [state.bills, state.creditCards, state.debts, state.accounts, state.grossAnnualIncome, state.country]
  )

  useEffect(() => {
    if (!mainRef.current) return
    mainRef.current.classList.remove('page-enter')
    // Re-trigger the animation on every tab switch by removing then re-adding the class.
    requestAnimationFrame(() => mainRef.current?.classList.add('page-enter'))
  }, [tab])

  // Round 21, item #3 — caches a thumbnail of whichever tab is genuinely open, for the
  // ⌘K palette's hover preview. Waits for the entrance animation to settle (~900ms) so the
  // captured frame shows the tab at rest, not mid fly-in. See thumbnailCache.ts's doc comment
  // for the full honest cached-vs-live explanation — this is NOT a live render per hover.
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const timer = window.setTimeout(() => { captureThumbnail(tab, el) }, 900)
    return () => window.clearTimeout(timer)
  }, [tab])

  // Single scroll listener drives every glass panel's subtle depth-shift sheen
  // via one shared CSS variable, rather than a listener per card.
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--scroll-y', String(window.scrollY))
        raf = 0
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Round 21, item #6 — a real "welcome back" toast, only when the tab was genuinely
  // backgrounded for a meaningful stretch (20+ minutes via the Page Visibility API, not a
  // quick alt-tab), showing what's still true right now so returning after lunch/overnight
  // doesn't mean re-orienting from a cold start.
  const hiddenAtRef = useRef<number | null>(null)
  useEffect(() => {
    const IDLE_THRESHOLD_MS = 20 * 60 * 1000
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now()
        return
      }
      const hiddenAt = hiddenAtRef.current
      hiddenAtRef.current = null
      if (hiddenAt === null) return
      const awayMs = Date.now() - hiddenAt
      if (awayMs < IDLE_THRESHOLD_MS) return
      const awayMinutes = Math.round(awayMs / 60000)
      const netWorth = calcNetWorth(state.accounts, state.creditCards, state.debts).netWorth
      const away = awayMinutes >= 120 ? `${Math.round(awayMinutes / 60)}h` : `${awayMinutes}m`
      showToast(`Welcome back — away ${away}. Net worth still ${formatCurrency(netWorth)}, health score ${healthScore}/100.`, { tone: 'info' })
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.accounts, state.creditCards, state.debts, healthScore])

  // Round 21, item #15 — this is a client-only, localStorage-only app: it keeps working fine
  // offline, but Deep has no way to tell it's offline vs just quiet. A real navigator.onLine
  // badge (+ actual online/offline events, not a poll) makes that honest instead of silent.
  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Round 21, item #21 — a real, honest "Saved" pulse: store.tsx already writes every state
  // change to localStorage synchronously on the same render; this just surfaces that real
  // write with a debounced UI pulse (not a fixed fake delay) so Deep has visible confidence
  // an edit actually persisted, without a permanent "Saved ✓" clutter sitting in the header.
  const saveTimerRef = useRef<number | null>(null)
  const firstSaveRender = useRef(true)
  useEffect(() => {
    if (firstSaveRender.current) { firstSaveRender.current = false; return }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    setJustSaved(true)
    saveTimerRef.current = window.setTimeout(() => setJustSaved(false), 1600)
    return () => { if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current) }
  }, [state])

  // Round 21, item #19 — a real count of active monthly bills due TODAY (not "soon"), surfaced
  // as a small badge dot on the Upcoming Payments nav tab so it's visible without opening the tab.
  const billsDueToday = useMemo(
    () => state.bills.filter((b) => b.active && b.frequency === 'monthly' && nextMonthlyDueDate(b.dueDay, todayIso()) === todayIso()).length,
    [state.bills]
  )

  const goTo = (id: TabId) => {
    if (tab === id) return
    setTab(id)
  }

  const tabCommands: PaletteCommand[] = TABS.map((t) => ({
    id: `tab-${t.id}`,
    label: `Go to ${t.label}`,
    previewId: t.id,
    run: () => goTo(t.id),
  }))

  return (
    <div className={cn('min-h-screen relative ambient-drift', tint)}>
      <AmbientBackground healthScore={healthScore} />
      <CursorGlow />
      <CommandPalette tabCommands={tabCommands} />
      <div className="relative z-10 page-enter-3d">
        <header className="border-b border-white/10 sticky top-0 z-40 backdrop-blur-md bg-[#05060a]/80">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-500" />
              <span className="gradient-heading font-bold text-lg tracking-tight">Clarity</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Round 21, item #21 — real debounced "Saved" pulse, not permanent chrome. */}
              <span
                className={cn(
                  'hidden md:inline-flex items-center gap-1 text-[10px] text-emerald-300/80 transition-opacity duration-500',
                  justSaved ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}
                aria-live="polite"
              >
                <Check className="w-3 h-3" /> Saved
              </span>
              {/* Round 21, item #15 — honest online/offline state; this app works fine offline
                  (everything's localStorage), this just says so instead of staying silent. */}
              {!isOnline && (
                <span title="You're offline — everything still saves locally, nothing is lost." className="hidden md:inline-flex items-center gap-1 text-[10px] text-amber-300/80 border border-amber-400/20 rounded-full px-2 py-0.5">
                  <WifiOff className="w-3 h-3" /> Offline
                </span>
              )}
              <SegmentedControl
                size="sm"
                value={state.householdView}
                onChange={setHouseholdView}
                options={[
                  { value: 'deep', label: 'Deep' },
                  { value: 'mimi', label: 'Mimi' },
                  { value: 'combined', label: 'Combined' },
                ]}
              />
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('clarity:open-command-palette'))}
                title="Quick actions: search and jump straight to any tab, or open a specific GEM VISA installment plan — press ⌘K (Ctrl+K) anytime, or click here."
                className="hidden md:inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-cyan-300 border border-white/10 hover:border-cyan-400/30 rounded-full px-2.5 py-1 transition-colors"
              >
                <Command className="w-3 h-3" />
                <span>Quick actions</span>
                <kbd className="text-[10px] text-white/30 border border-white/10 rounded px-1 ml-0.5">⌘K</kbd>
              </button>
              <NotificationBell />
            </div>
          </div>
          <nav className="max-w-6xl mx-auto px-4 pb-3 flex gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon
              const isActive = tab === t.id
              return (
                <button
                  key={t.id}
                  data-tab={t.id}
                  onClick={() => goTo(t.id)}
                  className={cn(
                    'nav-tab relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                    isActive
                      ? 'nav-tab-active bg-gradient-to-r from-cyan-400/20 to-purple-500/20 border border-cyan-400/30'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  )}
                >
                  <Icon className="nav-icon w-3.5 h-3.5" />
                  <span className={isActive ? 'gradient-heading' : undefined}>{t.label}</span>
                  {/* Round 21, item #19 — real count of bills due TODAY, not "soon"; only ever
                      shown on the tab that actually owns bill data, and only when real. */}
                  {t.id === 'upcoming' && billsDueToday > 0 && (
                    <span
                      title={`${billsDueToday} bill${billsDueToday === 1 ? '' : 's'} due today`}
                      className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-[3px] rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none shadow-[0_0_8px_-1px_rgba(255,45,85,0.8)]"
                    >
                      {billsDueToday}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </header>
        <main ref={mainRef} className="max-w-6xl mx-auto px-4 py-8 page-enter">
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'upcoming' && <UpcomingPayments />}
          {tab === 'networth' && <NetWorth />}
          {tab === 'calendar' && <BillCalendar />}
          {tab === 'transactions' && <Transactions />}
          {tab === 'budgets' && <Budgets />}
          {tab === 'debts' && <Debts />}
          {tab === 'shopping' && <ShoppingExpenses />}
          {tab === 'tools' && <Tools />}
        </main>
      </div>
    </div>
  )
}

function App() {
  const [booted, setBooted] = useState(false)

  return (
    <StoreProvider>
      <ToastProvider>
        {!booted && <BootSequence onDone={() => setBooted(true)} />}
        <PinGate>
          <AppContent />
        </PinGate>
      </ToastProvider>
    </StoreProvider>
  )
}

export default App
