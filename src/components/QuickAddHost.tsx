import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus } from 'lucide-react'
import { useStore } from '@/lib/store'
import { applyQuickEntry, undoQuickEntry, type QuickEntry } from '@/lib/liveFunds'
import { todayIso } from '@/lib/utils'
import { AddSheet } from './MobileHome'

/**
 * Desktop quick-add: an Add button and the N key open the same sheet the phone Home screen uses (focused on the
 * amount, last category remembered), with the same 4-second Undo. Phones keep their own Add button on Home.
 */
export function QuickAddHost() {
  const { setState } = useStore()
  const [open, setOpen] = useState(false)
  const [undo, setUndo] = useState<{ entry: QuickEntry; id: string; msg: string } | null>(null)
  const today = todayIso()

  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), 4000)
    return () => clearTimeout(t)
  }, [undo])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.repeat) return
      if (!window.matchMedia?.('(min-width: 768px)').matches) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
      // Another dialog is genuinely open (hidden ones, like the phone nav drawer on desktop, don't count).
      const visibleDialog = [...document.querySelectorAll('[role="dialog"]')].some((d) => {
        const r = d.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight && getComputedStyle(d).visibility !== 'hidden'
      })
      if (visibleDialog) return
      e.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add an expense or income (shortcut N)"
        title="Add an expense or income (N)"
        className="hidden md:flex fixed right-6 bottom-6 z-[55] items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 px-5 min-h-12 text-sm font-extrabold text-black shadow-lg shadow-cyan-500/20 hover:scale-105 active:scale-95 transition-transform"
      >
        <Plus className="w-4 h-4" strokeWidth={3} /> Add <kbd className="rounded bg-black/15 px-1.5 text-[10px] font-bold">N</kbd>
      </button>
      {open && createPortal(
        <AddSheet
          today={today}
          onClose={() => setOpen(false)}
          onSave={(e) => {
            const id = `quick-${Date.now()}`
            setState((s) => applyQuickEntry(s, e, today, id))
            setOpen(false)
            setUndo({ entry: e, id, msg: `Added ${e.kind === 'expense' ? '-' : '+'}$${e.amount} ${e.description || (e.kind === 'expense' ? 'Quick expense' : 'Quick income')}` })
          }}
        />, document.body)}
      {undo && createPortal(
        <div role="status" aria-live="polite" className="fixed bottom-24 right-6 z-[75] flex max-w-sm items-center justify-between gap-3 rounded-2xl border border-emerald-300/30 bg-[#0b0d14] px-4 py-3 text-sm text-white shadow-xl">
          <span className="min-w-0 truncate">{undo.msg}</span>
          <button type="button" onClick={() => { setState((s) => undoQuickEntry(s, undo.entry, today, undo.id)); setUndo(null) }} className="shrink-0 min-h-9 px-2 font-bold text-emerald-300">Undo</button>
        </div>, document.body)}
    </>
  )
}
