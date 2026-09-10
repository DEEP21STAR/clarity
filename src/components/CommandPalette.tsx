import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { Search, ImageOff, Keyboard } from 'lucide-react'
import { cn, formatCurrency, prefersReducedMotion } from '@/lib/utils'
import { getCachedThumbnail } from '@/lib/thumbnailCache'
import { fuzzyScore, recordCommandUsage, commandUsageRank } from '@/lib/commandPalette'

export interface PaletteCommand {
  id: string
  label: string
  hint?: string
  /** Tab id to look up a cached hover-preview thumbnail for (tab commands only — plan/bill commands have none). */
  previewId?: string
  run: () => void
}

/** Cmd/Ctrl+K quick-action search — jump to any tab, open a specific GEM VISA plan, or find a specific bill (real live-preview hint: actual amount + frequency, filtered as you type). Keyboard-driven throughout. */
export function CommandPalette({ tabCommands }: { tabCommands: PaletteCommand[] }) {
  const { state } = useStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

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

  // Round 21, item #20 — real fuzzy subsequence matching (fuzzyScore) instead of a plain
  // substring .includes(), so "gtd" or "dash" both find "Go to Dashboard". Item #3 — when the
  // query is empty, the default order is ranked by real past usage (most-used/most-recent
  // first) rather than always the same registration order.
  const filtered = useMemo(() => {
    if (!query.trim()) {
      return [...allCommands].sort((a, b) => {
        const [ac, ar] = commandUsageRank(a.id)
        const [bc, br] = commandUsageRank(b.id)
        return ac - bc || ar - br
      })
    }
    return allCommands
      .map((c) => ({ c, score: fuzzyScore(c.label, query) }))
      .filter((x): x is { c: PaletteCommand; score: number } => x.score !== null)
      .sort((a, b) => a.score - b.score)
      .map((x) => x.c)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCommands, query])

  const [showShortcuts, setShowShortcuts] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') { setOpen(false); setShowShortcuts(false) }
      // Round 21, item #4 — a real "?" shortcuts cheatsheet, guarded so it never fires while
      // actually typing "?" into any input/textarea anywhere in the app (including this
      // palette's own search box).
      if (e.key === '?' && !open) {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
        e.preventDefault()
        setShowShortcuts((v) => !v)
      }
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
  }, [open])

  useEffect(() => { setSelected(0) }, [query])
  useEffect(() => { if (!open) setHoveredId(null) }, [open])

  // Coordinator follow-up — Deep found the preview too small to actually identify a
  // destination at a glance, just confirm one exists. Real fix: the preview pops in small,
  // then genuinely grows to a much larger size a beat later (hover-in), and shrinks back down
  // before disappearing (hover-out) rather than cutting instantly — `previewCmd` is kept
  // mounted slightly longer than `hoveredId` itself specifically so that shrink is visible,
  // not skipped. `grown` drives the actual width transition.
  const [previewCmd, setPreviewCmd] = useState<PaletteCommand | null>(null)
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const cmd = hoveredId ? filtered.find((c) => c.id === hoveredId) : undefined
    if (cmd?.previewId) {
      setPreviewCmd(cmd)
      if (prefersReducedMotion()) { setGrown(true); return }
      setGrown(false)
      const growTimer = window.setTimeout(() => setGrown(true), 60)
      return () => window.clearTimeout(growTimer)
    }
    setGrown(false)
    if (prefersReducedMotion()) { setPreviewCmd(null); return }
    const clearTimer = window.setTimeout(() => setPreviewCmd(null), 220)
    return () => window.clearTimeout(clearTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredId])

  const runSelected = () => {
    const cmd = filtered[selected]
    if (!cmd) return
    recordCommandUsage(cmd.id)
    cmd.run()
    setOpen(false)
    setQuery('')
  }

  if (!open) {
    return showShortcuts ? <ShortcutsCheatsheet onClose={() => setShowShortcuts(false)} /> : null
  }

  const hoveredThumb = previewCmd?.previewId ? getCachedThumbnail(previewCmd.previewId) : null
  const reduceMotion = prefersReducedMotion()

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 flex items-start justify-center pt-24" onClick={() => setOpen(false)}>
      {/* shrink-0 on both children — real bug found live: this row's own width resolves via
          shrink-to-fit (its parent centers it with no fixed width), and the palette panel uses
          w-full (100% of that resolving row). Growing the preview from w-64 to w-[26rem]
          without shrink-0 fed into that same circular sizing computation and both children got
          silently compressed by the browser's default flex-shrink:1 — confirmed live via
          getComputedStyle (the preview plateaued around 258px instead of the real 416px).
          shrink-0 makes both panels always render at their real intended width. */}
      <div className="relative flex items-start gap-3">
        <div
          className="w-full max-w-md shrink-0 rounded-2xl border border-cyan-400/30 bg-[#0b0d14] shadow-[0_0_60px_-10px_rgba(34,211,238,0.4)] overflow-hidden"
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
                onClick={() => { recordCommandUsage(cmd.id); cmd.run(); setOpen(false); setQuery('') }}
                onMouseEnter={() => setHoveredId(cmd.id)}
                onMouseLeave={() => setHoveredId((v) => (v === cmd.id ? null : v))}
                className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${i === selected ? 'bg-cyan-400/10 text-cyan-200' : 'text-white/70 hover:bg-white/5'}`}
              >
                <span>{cmd.label}</span>
                {cmd.hint && <span className="text-xs text-white/30">{cmd.hint}</span>}
              </button>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between text-[10px] text-white/25">
            <span>{!query.trim() ? 'Sorted by what you actually use' : `Fuzzy-matched · ${filtered.length} result${filtered.length === 1 ? '' : 's'}`}</span>
            <button onClick={() => { setOpen(false); setShowShortcuts(true) }} className="flex items-center gap-1 hover:text-cyan-300">
              <Keyboard className="w-3 h-3" /> Shortcuts <kbd className="border border-white/10 rounded px-1">?</kbd>
            </button>
          </div>
        </div>

        {/* Round 21, item #3 — hover-to-preview thumbnail. Cached snapshot, not a live render;
            see thumbnailCache.ts for the full honest explanation. Only tab commands carry a
            previewId, so plan/bill rows never show one.
            Coordinator follow-up — real grow-on-hover: pops in small (w-64), then genuinely
            widens to w-[26rem] once `grown` flips true a beat later, and eases back down to
            w-64 before actually unmounting on hover-out (previewCmd/grown state machine
            above), so it reads as one continuous expand/shrink motion, not a size snap. */}
        {previewCmd?.previewId && (
          <div
            data-testid="cmdk-preview"
            className={cn(
              'shrink-0 rounded-xl border border-cyan-400/30 bg-[#0b0d14] shadow-[0_0_50px_-8px_rgba(34,211,238,0.45)] overflow-hidden',
              !reduceMotion && 'command-preview-pop transition-[width] duration-300 ease-out',
              grown ? 'w-[26rem]' : 'w-64'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {hoveredThumb ? (
              <img src={hoveredThumb} alt="" className="w-full aspect-[420/280] object-cover object-top" />
            ) : (
              <div className="w-full aspect-[420/280] flex flex-col items-center justify-center gap-1.5 text-white/25 bg-white/[0.02]">
                <ImageOff className="w-5 h-5" />
                <span className="text-[10px] text-center px-3">No preview yet — visit this tab once to cache one</span>
              </div>
            )}
            <div className="px-3 py-2 border-t border-white/10 flex items-center justify-between">
              <span className="text-[10px] text-white/40">{previewCmd.label}</span>
              <span className="text-[9px] text-white/25" title="Cached snapshot from the last time you opened this tab — not a live render.">cached</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: '⌘K / Ctrl K', desc: 'Open Quick Actions — jump to any tab, plan, or bill' },
  { keys: '↑ ↓', desc: 'Move the highlighted Quick Actions result' },
  { keys: 'Enter', desc: 'Run the highlighted Quick Actions result' },
  { keys: 'Esc', desc: 'Close Quick Actions or this cheatsheet' },
  { keys: '?', desc: 'Show this shortcuts cheatsheet (from anywhere, when not typing)' },
  { keys: '/', desc: 'Jump to the Transactions ledger search' },
]

/** Round 21, item #4 — a real keyboard-shortcuts reference, since this app has quietly grown several real shortcuts with nowhere that lists them all in one place. */
function ShortcutsCheatsheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === '?') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-cyan-400/30 bg-[#0b0d14] shadow-[0_0_60px_-10px_rgba(34,211,238,0.4)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <Keyboard className="w-4 h-4 text-cyan-300" />
          <span className="text-sm font-semibold text-white">Keyboard shortcuts</span>
        </div>
        <div className="px-4 py-3 space-y-2.5">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-white/60">{s.desc}</span>
              <kbd className="shrink-0 text-[10px] text-cyan-200 border border-cyan-400/20 bg-cyan-400/5 rounded px-1.5 py-0.5 whitespace-nowrap">{s.keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
