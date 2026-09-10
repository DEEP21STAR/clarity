import { useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

/**
 * Progressive-disclosure drawer — the granular table/detail tier of the
 * 3-tier pattern (hero numbers → trend/context → tucked-away detail).
 * Collapsed by default unless `defaultOpen` is set; real CSS max-height
 * transition, not an instant show/hide.
 */
export function Disclosure({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyRef = useRef<HTMLDivElement>(null)

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-medium text-cyan-300 hover:text-cyan-200"
      >
        <ChevronRight className={cn('w-4 h-4 transition-transform', open && 'rotate-90')} />
        {title}
      </button>
      <div
        ref={bodyRef}
        className="disclosure-body"
        style={{ maxHeight: open ? bodyRef.current?.scrollHeight ?? 2000 : 0, opacity: open ? 1 : 0 }}
      >
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}
