import { useEffect, useRef, useState } from 'react'
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
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, CalendarClock, Receipt, PieChart, CreditCard, ShoppingCart, Wrench, TrendingUp, CalendarDays,
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
  const [tab, setTab] = useState<TabId>('upcoming')
  const mainRef = useRef<HTMLDivElement>(null)
  const tint = useTimeOfDayTint()

  useEffect(() => {
    if (!mainRef.current) return
    mainRef.current.classList.remove('page-enter')
    // Re-trigger the animation on every tab switch by removing then re-adding the class.
    requestAnimationFrame(() => mainRef.current?.classList.add('page-enter'))
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

  const goTo = (id: TabId) => {
    if (tab === id) return
    setTab(id)
  }

  const tabCommands: PaletteCommand[] = TABS.map((t) => ({
    id: `tab-${t.id}`,
    label: `Go to ${t.label}`,
    run: () => goTo(t.id),
  }))

  return (
    <div className={cn('min-h-screen relative', tint)}>
      <AmbientBackground />
      <CommandPalette tabCommands={tabCommands} />
      <div className="relative z-10 page-enter-3d">
        <header className="border-b border-white/10 sticky top-0 z-40 backdrop-blur-md bg-[#05060a]/80">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-500" />
              <span className="gradient-heading font-bold text-lg tracking-tight">Clarity</span>
            </div>
            <div className="flex items-center gap-3">
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
              <span className="text-xs text-white/30 hidden md:inline">⌘K for quick actions</span>
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
                    'nav-tab flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                    isActive
                      ? 'nav-tab-active bg-gradient-to-r from-cyan-400/20 to-purple-500/20 border border-cyan-400/30'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  )}
                >
                  <Icon className="nav-icon w-3.5 h-3.5" />
                  <span className={isActive ? 'gradient-heading' : undefined}>{t.label}</span>
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
      {!booted && <BootSequence onDone={() => setBooted(true)} />}
      <PinGate>
        <AppContent />
      </PinGate>
    </StoreProvider>
  )
}

export default App
