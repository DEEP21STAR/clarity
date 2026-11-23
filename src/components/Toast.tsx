import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, X } from 'lucide-react'

export interface ToastOptions {
  tone?: 'success' | 'info' | 'warning'
  actionLabel?: string
  onAction?: () => void
  durationMs?: number
}

interface ToastItem extends ToastOptions {
  id: number
  message: string
  exiting?: boolean
}

interface ToastContextValue {
  showToast: (message: string, opts?: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * #35 — real toast confirmations on every add/edit action, and the shared
 * mechanism #49's "Undo" action rides on (pass `actionLabel: 'Undo'` +
 * `onAction: () => restoreState(snapshotTakenBeforeTheEdit)`).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, exiting: true } : t)))
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 260)
  }, [])

  const showToast = useCallback((message: string, opts: ToastOptions = {}) => {
    const id = ++idRef.current
    setToasts((ts) => [...ts, { id, message, ...opts }])
    const duration = opts.durationMs ?? 4000
    setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`glass-panel flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] ${t.exiting ? 'toast-exit' : 'toast-enter'} ${
              t.tone === 'warning' ? 'border-amber-400/40' : t.tone === 'info' ? 'border-cyan-400/30' : 'border-emerald-400/30'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 shrink-0 ${t.tone === 'warning' ? 'text-amber-300' : t.tone === 'info' ? 'text-cyan-300' : 'text-emerald-300'}`} />
            <span className="text-white/80">{t.message}</span>
            {t.actionLabel && (
              <button
                onClick={() => { t.onAction?.(); dismiss(t.id) }}
                className="text-cyan-300 hover:text-cyan-200 font-semibold text-xs uppercase tracking-wide"
              >
                {t.actionLabel}
              </button>
            )}
            <button onClick={() => dismiss(t.id)} className="text-white/30 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
