import { Component, type ReactNode } from 'react'

const RETRY_KEY = 'clarity-chunk-retry'

/** True for "a lazily loaded file could not be fetched": what a stale cached copy of the app hits right after an update. */
export function isChunkLoadError(err: unknown): boolean {
  const msg = String((err as { message?: string } | null)?.message ?? err ?? '')
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk .* failed/i.test(msg)
}

/** Drop the cached copy of the app (service worker + caches) so the next load fetches the current version, then reload. */
export async function clearCachesAndReload(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
  } catch { /* ignore */ }
  try {
    const keys = (await globalThis.caches?.keys?.()) ?? []
    await Promise.all(keys.map((k) => caches.delete(k)))
  } catch { /* ignore */ }
  location.reload()
}

/**
 * Last line of defence: without this, any failure while a screen loads or renders unmounts the whole app and leaves a blank page.
 * A missing lazily loaded file (stale cache right after an update) is retried once automatically; anything else shows a plain message.
 * Your data is not touched: it lives in this browser's storage, not in the cached app.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; /** change this (e.g. the active tab) to clear a shown error */ resetKey?: string; /** a card inside the page instead of a full-screen panel, so the rest of the app stays usable */ inline?: boolean }, { error: Error | null }> {
  state = { error: null as Error | null }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    if (!isChunkLoadError(error)) return
    let alreadyRetried = false
    try { alreadyRetried = sessionStorage.getItem(RETRY_KEY) === '1'; sessionStorage.setItem(RETRY_KEY, '1') } catch { /* ignore */ }
    if (!alreadyRetried) void clearCachesAndReload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const { inline } = this.props
    return (
      <div role="alert" className={inline ? 'flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-12 text-center text-white' : 'flex min-h-screen items-center justify-center bg-[#05060a] px-6 text-center text-white'}>
        <div className="max-w-md space-y-4">
          <h1 className="text-xl font-bold">Clarity couldn't load this screen</h1>
          <p className="text-sm leading-relaxed text-white/70">
            This usually happens right after an update, when your device still holds the old copy of the app. Your data is safe: it stays on this device.
          </p>
          <button
            type="button"
            onClick={() => void clearCachesAndReload()}
            className="min-h-11 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 px-6 text-sm font-extrabold text-black"
          >
            Reload
          </button>
          <p className="break-words text-xs text-white/55">{error.message}</p>
        </div>
      </div>
    )
  }
}
