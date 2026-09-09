import { useState } from 'react'
import { StoreProvider } from '@/lib/store'
import { BootSequence } from './components/BootSequence'
import { Dashboard } from './components/Dashboard'
import { UpcomingPayments } from './components/UpcomingPayments'
import { Transactions } from './components/Transactions'
import { Budgets } from './components/Budgets'
import { Debts } from './components/Debts'
import { ShoppingExpenses } from './components/ShoppingExpenses'
import { Tools } from './components/Tools'
import { cn } from '@/lib/utils'
import { LayoutDashboard, CalendarClock, Receipt, PieChart, CreditCard, ShoppingCart, Wrench } from 'lucide-react'

type TabId = 'dashboard' | 'upcoming' | 'transactions' | 'budgets' | 'debts' | 'shopping' | 'tools'

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'upcoming', label: 'Upcoming Payments', icon: CalendarClock },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'budgets', label: 'Budgets', icon: PieChart },
  { id: 'debts', label: 'Debts', icon: CreditCard },
  { id: 'shopping', label: 'Shopping & Expenses', icon: ShoppingCart },
  { id: 'tools', label: 'Tools', icon: Wrench },
]

function App() {
  const [booted, setBooted] = useState(false)
  const [tab, setTab] = useState<TabId>('upcoming')

  return (
    <StoreProvider>
      {!booted && <BootSequence onDone={() => setBooted(true)} />}
      <div className="min-h-screen">
        <header className="border-b border-white/10 sticky top-0 z-40 backdrop-blur-md bg-[#05060a]/80">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-500" />
              <span className="font-bold text-lg tracking-tight text-white">Clarity</span>
            </div>
            <span className="text-xs text-white/30 hidden md:inline">Deep's Budget Dashboard</span>
          </div>
          <nav className="max-w-6xl mx-auto px-4 pb-3 flex gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                    tab === t.id
                      ? 'bg-gradient-to-r from-cyan-400/20 to-purple-500/20 text-white border border-cyan-400/30'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              )
            })}
          </nav>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'upcoming' && <UpcomingPayments />}
          {tab === 'transactions' && <Transactions />}
          {tab === 'budgets' && <Budgets />}
          {tab === 'debts' && <Debts />}
          {tab === 'shopping' && <ShoppingExpenses />}
          {tab === 'tools' && <Tools />}
        </main>
      </div>
    </StoreProvider>
  )
}

export default App
