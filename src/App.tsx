import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { StoreProvider, useStore, STORAGE_KEY } from '@/lib/store'
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
import { ThumbnailPrecacher } from './components/ThumbnailPrecacher'
import { SegmentedControl } from './components/SegmentedControl'
import { ToastProvider, useToast } from './components/Toast'
import { NotificationBell } from './components/NotificationBell'
import { CursorGlow } from './components/CursorGlow'
import { MobileNavDrawer } from './components/MobileNavDrawer'
import { SetupWizard } from './components/SetupWizard'
import { Welcome } from './components/Welcome'
import { WhetuFooter } from './components/WhetuFooter'
import { computeCurrentHealthScore, calcNetWorth, dueTodayBills } from '@/lib/logic'
import { cn, formatCurrency, todayIso } from '@/lib/utils'
import { captureThumbnail } from '@/lib/thumbnailCache'
import {
  LayoutDashboard, CalendarClock, Receipt, PieChart, CreditCard, ShoppingCart, Wrench, TrendingUp, CalendarDays, Command, WifiOff, Check, Menu,
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

/**
 * Round 21 follow-up — real per-tab colour ownership for the nav bar, matching the same
 * "each section owns a colour" pattern already used everywhere else in the app (Net Worth
 * green, Debts red/pink, etc — both kept here deliberately to match). Fed to each nav button
 * as a `--tab-accent` CSS custom property (not a Tailwind utility class — a runtime-computed
 * hex can't be a static Tailwind class without it being purged from the build), consumed by
 * the real hover/rest-state rules in index.css. Nine genuinely distinct hues, chosen so no two
 * adjacent tabs in the bar share a hue family.
 */
const TAB_ACCENTS: Record<TabId, string> = {
  dashboard: '#22d3ee',
  upcoming: '#f59e0b',
  networth: '#34d399',
  calendar: '#60a5fa',
  transactions: '#a78bfa',
  budgets: '#e879f9',
  debts: '#fb7185',
  shopping: '#fb923c',
  tools: '#2dd4bf',
}

/** Subtle time-of-day ambient tint — cooler in the morning, warmer in the evening. Same idea as the time-of-day theming already used on Deep's Omarchy desktop. */
function useTimeOfDayTint(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 11) return 'tint-morning'
  if (hour >= 17 && hour < 23) return 'tint-evening'
  return ''
}

export function AppContent() {
  const { state, setHouseholdView } = useStore()
  const { showToast } = useToast()
  const [tab, setTab] = useState<TabId>('upcoming')
  const mainRef = useRef<HTMLDivElement>(null)
  const tint = useTimeOfDayTint()
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [justSaved, setJustSaved] = useState(false)
  // 2026-09-23 — mobile nav drawer. The desktop tab bar (9 tabs, scroll-to-discover) is a real
  // usability gap on a phone: too many targets to fit, and horizontal scroll-to-find is a poor
  // primary nav pattern for touch. Upcoming Payments stays the default landing tab either way.
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

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
  // Real fix (Deep): the badge told him a NUMBER was due but never WHAT — a Nielsen #1
  // violation (a tooltip that can't explain itself). Now keeps the actual bills, not just a
  // count, so the tooltip can name them; `dueTodayBills` is the same shared helper
  // UpcomingPayments.tsx uses for its highlight-on-click, so the two can never disagree.
  const billsDueTodayList = useMemo(() => dueTodayBills(state.bills, todayIso()), [state.bills])
  const billsDueToday = billsDueTodayList.length

  const goTo = (id: TabId) => {
    if (tab === id) return
    setTab(id)
  }

  // Real fix (Deep): clicking the Upcoming Payments badge while ALREADY on that tab used to
  // do nothing perceptible (goTo() is a no-op for the current tab) — "looks like it's
  // something important but it's not telling me." Fresh navigation TO the tab already gets its
  // own visible feedback (the page itself changes), so this only fires for the specific
  // already-there case Deep hit — which also sidesteps a real mount-order race: dispatching on
  // first navigation fires before UpcomingPayments.tsx has mounted its listener (confirmed live
  // — the event fired into the void, no highlight ever appeared), since `setTab` is
  // async/batched but the dispatch was synchronous.
  const handleTabClick = (id: TabId) => {
    if (id === 'upcoming' && tab === 'upcoming' && billsDueToday > 0) {
      window.dispatchEvent(new CustomEvent('clarity:highlight-due-bills'))
    }
    goTo(id)
  }

  const tabCommands: PaletteCommand[] = TABS.map((t) => ({
    id: `tab-${t.id}`,
    label: `Go to ${t.label}`,
    previewId: t.id,
    run: () => goTo(t.id),
  }))

  // Same tab-id -> component mapping as the real <main> below, extracted so
  // ThumbnailPrecacher can render any tab's real content off-screen too.
  const renderTabContent = (id: string) => {
    switch (id as TabId) {
      case 'dashboard': return <Dashboard />
      case 'upcoming': return <UpcomingPayments />
      case 'networth': return <NetWorth />
      case 'calendar': return <BillCalendar />
      case 'transactions': return <Transactions />
      case 'budgets': return <Budgets />
      case 'debts': return <Debts />
      case 'shopping': return <ShoppingExpenses />
      case 'tools': return <Tools />
      default: return null
    }
  }

  return (
    <div className={cn('min-h-screen relative ambient-drift', tint)}>
      <AmbientBackground healthScore={healthScore} />
      <CursorGlow />
      <CommandPalette tabCommands={tabCommands} />
      <div className="relative z-10 page-enter-3d">
        <header className="border-b border-white/10 sticky top-0 z-40 backdrop-blur-md bg-[#05060a]/80">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Mobile-only hamburger — opens MobileNavDrawer. Desktop keeps the horizontal
                  tab row below, this button is invisible there (md:hidden). */}
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
                className="md:hidden w-8 h-8 -ml-1 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Menu className="w-4.5 h-4.5" />
              </button>
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
              {/* Overnight audit found a real gap: this is the only Deep/Mimi/Combined toggle in
                  the app (global header, visible on every tab), but householdView is only
                  actually READ in one place — UpcomingPayments.tsx's credit card filter. Every
                  other tab (Dashboard's income/bills stats included) always shows the full
                  combined household figures regardless of this toggle's position, since gross
                  income and total fixed bills are tracked as single household-level numbers,
                  not split per-person anywhere except the dedicated Household Bill Split card.
                  That's a real, defensible design (there's no separate "Deep's income" field to
                  show), but a global header toggle silently doing nothing on 8 of 9 tabs reads
                  as broken rather than intentional — this tooltip makes the real scope honest
                  instead of leaving it to look like a bug. */}
              {/* 2026-09-23 round 6 — "it should just say the user who's logged in" (Deep). This
                  toggle only ever made sense for a two-person household (it's a GEM VISA card
                  filter, per-card ownership of two real cards) — for a single-person account
                  (secondaryName === '', the real signal a solo onboarding leaves behind) there's
                  nothing to filter between, so showing a 3-way Deep/Mimi/Combined toggle read as
                  broken rather than just unnecessary. Labels are now the real onboarded names,
                  not hardcoded "Deep"/"Mimi" literals, for the two-person case. */}
              {state.secondaryName ? (
                <span title="Filters which GEM VISA card(s) show on Upcoming Payments. Every other tab (including this Dashboard) always shows the full combined household total — income and bills aren't tracked per-person.">
                  <SegmentedControl
                    size="sm"
                    value={state.householdView}
                    onChange={setHouseholdView}
                    options={[
                      { value: 'deep', label: state.primaryName },
                      { value: 'mimi', label: state.secondaryName },
                      { value: 'combined', label: 'Combined' },
                    ]}
                  />
                </span>
              ) : (
                <span className="text-xs font-medium text-white/50 px-1">{state.primaryName}</span>
              )}
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
          {/* Mobile-only current-tab strip — the hamburger replaces the tab row entirely on
              mobile, so without this there's no visible "where am I" once the header's collapsed. */}
          <div className="md:hidden max-w-6xl mx-auto px-4 pb-3 flex items-center gap-1.5 text-xs text-white/50">
            {(() => {
              const current = TABS.find((t) => t.id === tab)
              if (!current) return null
              const Icon = current.icon
              return (
                <>
                  <Icon className="w-3.5 h-3.5" style={{ color: TAB_ACCENTS[tab] }} />
                  <span className="font-medium" style={{ color: TAB_ACCENTS[tab] }}>{current.label}</span>
                </>
              )
            })()}
          </div>
          <nav className="max-w-6xl mx-auto px-4 pb-3 hidden md:flex gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon
              const isActive = tab === t.id
              return (
                <button
                  key={t.id}
                  data-tab={t.id}
                  onClick={() => handleTabClick(t.id)}
                  style={{ '--tab-accent': TAB_ACCENTS[t.id] } as CSSProperties}
                  className={cn(
                    'nav-tab relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                    isActive
                      ? 'nav-tab-active bg-gradient-to-r from-cyan-400/20 to-purple-500/20 border border-cyan-400/30'
                      : 'nav-tab-inactive'
                  )}
                >
                  <Icon className="nav-icon w-3.5 h-3.5" />
                  <span className={isActive ? 'gradient-heading' : undefined}>{t.label}</span>
                  {/* Round 21, item #19 — real count of bills due TODAY, not "soon"; only ever
                      shown on the tab that actually owns bill data, and only when real.
                      Real fix (Deep): tooltip now names the actual bill(s), not just the count —
                      a badge that can't explain itself on hover is the real heuristic-#1 gap here. */}
                  {t.id === 'upcoming' && billsDueToday > 0 && (
                    <span
                      title={
                        billsDueToday === 1
                          ? `${billsDueTodayList[0].name} due today — click to see it`
                          : `${billsDueToday} bills due today: ${billsDueTodayList.map((b) => b.name).join(', ')} — click to see them`
                      }
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
        <WhetuFooter name={state.primaryName} />
      </div>
      {/* Coordinator follow-up fix, verified live — the ⌘K hover-preview mechanism itself
          worked, but only cached a thumbnail AFTER a real visit, so most tabs legitimately
          showed "No preview yet" on a genuine first use. Pre-warms every NOT-YET-CACHED tab
          off-screen, one at a time, staggered — see ThumbnailPrecacher.tsx's doc comment. */}
      <ThumbnailPrecacher tabIds={TABS.map((t) => t.id)} skipId={tab} renderTab={renderTabContent} />
      <MobileNavDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        tabs={TABS}
        activeTab={tab}
        accents={TAB_ACCENTS}
        onSelect={(id) => handleTabClick(id as TabId)}
      />
    </div>
  )
}

function App() {
  const [booted, setBooted] = useState(false)

  // 2026-09-23 — ?wizard=demo entry point for testing the onboarding wizard concept in
  // isolation. Checked BEFORE StoreProvider/PinGate on purpose: SetupWizard never touches
  // useStore() or the real 'clarity-dashboard-state-v5' key at all, so there's no path by
  // which testing it could read or overwrite Deep's real household data.
  const isWizardDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('wizard') === 'demo'
  if (isWizardDemo) return <SetupWizard />

  // 2026-09-23 round 5 — "no introduction of why we're doing this... it's just dumped on
  // straight away" (Deep). Real first-run detection: computed once via useState's lazy
  // initializer (not re-evaluated on every render, which matters because the wizard itself
  // writes to this exact key partway through onboarding — re-checking mid-flow would flip this
  // back to false and yank the user out of their own setup). "First run" means this browser has
  // literally never had the real STORAGE_KEY written at all — Deep's own account, and anyone
  // who's already used the app, always has that key populated from every prior session, so this
  // never re-triggers for existing data. Only a genuinely fresh browser sees Welcome -> Wizard
  // before the dashboard; everyone else goes straight to the same boot -> PIN -> dashboard flow
  // as before.
  const [isFirstRun] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === null)
  const [onboardingStage, setOnboardingStage] = useState<'welcome' | 'wizard' | 'done'>(isFirstRun ? 'welcome' : 'done')

  if (onboardingStage !== 'done') {
    if (!booted) return <BootSequence onDone={() => setBooted(true)} />
    if (onboardingStage === 'welcome') return <Welcome onContinue={() => setOnboardingStage('wizard')} />
    return <SetupWizard mode="onboarding" />
  }

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
