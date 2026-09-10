import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { Search } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export interface PaletteCommand {
  id: string
  label: string
  hint?: string
  run: () => void
}

/** Cmd/Ctrl+K quick-action search — jump to any tab, open a specific GEM VISA plan, or find a specific bill (real live-preview hint: actual amount + frequency, filtered as you type). Keyboard-driven throughout. */
export function CommandPalette({ tabCommands }: { tabCommands: PaletteCommand[] }) {
  const { state } = useStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)

  const planCommands: PaletteCommand[] = useMemo(
    () =>
      state.creditCards.flatMap((card) =>
        card.plans.map((plan) => ({
          id: `plan-${plan.id}`,
          label: `Open plan: ${plan.name}`,
          hint: card.name,
          run: () => {
            const tabBtn = document.querySelector<HTMLButtonElement>('[data-tab="upcoming"]')
            tabBtn?.click()
            setTimeout(() => document.getElementById(`plan-${plan.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
          },
        }))
      ),
    [state.creditCards]
  )

  // #30/#48 — unified search reaches bills too, not just tabs/plans, with a real
  // live-preview hint (actual amount + frequency, not a static label).
  const billCommands: PaletteCommand[] = useMemo(
    () =>
      state.bills.map((bill) => ({
        id: `bill-${bill.id}`,
        label: `Bill: ${bill.name}`,
        hint: `${formatCurrency(bill.amount)} ${bill.frequency}`,
        run: () => document.querySelector<HTMLButtonElement>('[data-tab="upcoming"]')?.click(),
      })),
    [state.bills]
  )

  const allCommands = [...tabCommands, ...planCommands, ...billCommands]
  const filtered = query.trim() ? allCommands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase())) : allCommands

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    // Lets the header's "quick actions" button open the same palette without duplicating
    // the open logic — a plain custom event, same reach-through pattern already used by
    // planCommands' tab-click-then-scroll above, rather than threading open state as a prop.
    const openHandler = () => setOpen(true)
    window.addEventListener('keydown', handler)
    window.addEventListener('clarity:open-command-palette', openHandler)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('clarity:open-command-palette', openHandler)
    }
  }, [])

  useEffect(() => { setSelected(0) }, [query])

  if (!open) return null

  const runSelected = () => {
    filtered[selected]?.run()
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 flex items-start justify-center pt-24" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-md rounded-2xl border border-cyan-400/30 bg-[#0b0d14] shadow-[0_0_60px_-10px_rgba(34,211,238,0.4)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <Search className="w-4 h-4 text-white/40" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setSelected((s) => Math.min(filtered.length - 1, s + 1))
              if (e.key === 'ArrowUp') setSelected((s) => Math.max(0, s - 1))
              if (e.key === 'Enter') runSelected()
            }}
            placeholder="Jump to a tab, plan, bill, or action..."
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/30"
          />
          <kbd className="text-[10px] text-white/30 border border-white/10 rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto py-2">
          {filtered.length === 0 && <div className="px-4 py-3 text-sm text-white/30">No matches.</div>}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => { cmd.run(); setOpen(false); setQuery('') }}
              className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${i === selected ? 'bg-cyan-400/10 text-cyan-200' : 'text-white/70 hover:bg-white/5'}`}
            >
              <span>{cmd.label}</span>
              {cmd.hint && <span className="text-xs text-white/30">{cmd.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
