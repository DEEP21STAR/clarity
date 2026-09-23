import { useEffect, type CSSProperties } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavTab {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface MobileNavDrawerProps {
  open: boolean
  onClose: () => void
  tabs: NavTab[]
  activeTab: string
  accents: Record<string, string>
  onSelect: (id: string) => void
}

/**
 * Mobile-only slide-out nav — replaces the desktop horizontal tab bar (which relies on
 * scroll-to-discover, fine with a mouse/trackpad but a poor fit for a phone: 9 tabs don't fit,
 * and a horizontally-scrolling row of small targets is easy to mis-tap). Reuses the exact same
 * TABS/TAB_ACCENTS the desktop nav already owns (passed as props) so there's one source of
 * truth for tab order/colour, never a second list that can drift.
 */
export function MobileNavDrawer({ open, onClose, tabs, activeTab, accents, onSelect }: MobileNavDrawerProps) {
  // Lock body scroll while the drawer's open — otherwise the page behind it scrolls along with
  // a touch-drag on the drawer itself, a real mobile-only footgun a mouse never hits.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-[70] w-[280px] max-w-[82vw] bg-[#090b12] border-r border-white/10 md:hidden',
          'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-4 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-500" />
            <span className="gradient-heading font-bold text-base tracking-tight">Clarity</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {tabs.map((t) => {
            const Icon = t.icon
            const isActive = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => { onSelect(t.id); onClose() }}
                style={{ '--tab-accent': accents[t.id] } as CSSProperties}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors text-left',
                  isActive ? 'bg-gradient-to-r from-cyan-400/15 to-purple-500/15 text-[color:var(--tab-accent)]' : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                )}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: isActive ? 'var(--tab-accent)' : 'rgba(255,255,255,0.25)', boxShadow: isActive ? '0 0 8px var(--tab-accent)' : 'none' }}
                />
                <Icon className="w-4 h-4 shrink-0" />
                <span>{t.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="px-4 py-3 border-t border-white/10 text-[10px] text-white/30">
          Deep + Mimi · Clarity
        </div>
      </div>
    </>
  )
}
