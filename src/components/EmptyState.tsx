import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * An empty tab or card should teach, not just say "nothing here": what this will show, and the one thing to do next.
 * One consistent look everywhere (a soft glowing icon, a clear title, one line of help, at most one action).
 */
export function EmptyState({ icon: Icon, title, body, action, className }: {
  icon: ComponentType<{ className?: string }>
  title: string
  body: ReactNode
  action?: { label: string; onClick: () => void }
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center text-center px-4 py-8', className)}>
      <span className="relative mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200 shadow-[0_0_28px_-6px_rgba(34,211,238,0.55)]">
        <Icon className="h-6 w-6" />
      </span>
      <p className="text-base font-semibold text-white/90">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-snug text-white/70">{body}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 min-h-11 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 px-5 text-sm font-bold text-black"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
