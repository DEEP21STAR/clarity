/**
 * When the tab-preview thumbnails (the hover previews in the Cmd+K palette) are worth capturing at all.
 * Capturing means rendering a tab off-screen and rasterising it with html2canvas, which on a first launch
 * cost about 1.5 s of main-thread time right while the app was trying to become usable. The hover preview is
 * a desktop pointer feature, so touch devices skip it entirely, as do data-saver and very-low-memory devices.
 * Everything else waits until the app has been idle for a while.
 */
export interface ThumbEnv {
  /** A real hovering pointer (mouse/trackpad), not a touch screen. */
  hoverFine: boolean
  saveData?: boolean
  deviceMemoryGb?: number
}

export const PRECACHE_START_DELAY_MS = 10_000
export const ON_VISIT_CAPTURE_DELAY_MS = 2_500

export function shouldCaptureThumbnails(e: ThumbEnv): boolean {
  if (!e.hoverFine) return false
  if (e.saveData) return false
  if (e.deviceMemoryGb !== undefined && e.deviceMemoryGb <= 2) return false
  return true
}

export function currentThumbEnv(): ThumbEnv {
  if (typeof window === 'undefined') return { hoverFine: false }
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number }
  return {
    hoverFine: window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false,
    saveData: nav.connection?.saveData,
    deviceMemoryGb: nav.deviceMemory,
  }
}

/** Run `fn` when the browser is idle (falls back to a timeout where requestIdleCallback is missing). */
export function whenIdle(fn: () => void, timeoutMs = 4000): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: timeoutMs })
    return () => w.cancelIdleCallback?.(id)
  }
  const id = window.setTimeout(fn, 200)
  return () => window.clearTimeout(id)
}

/**
 * The tab previews only appear in the Cmd+K palette, and capturing one freezes the page for most of a second. So nothing is captured
 * until the palette has been opened at least once on this device; from then on previews warm up quietly as you use the app.
 */
export const THUMBS_WANTED_KEY = 'clarity-thumbs-wanted'
export const THUMBS_WANTED_EVENT = 'clarity:thumbs-wanted'

export function thumbsWanted(storage: Pick<Storage, 'getItem'> | undefined): boolean {
  try { return storage?.getItem(THUMBS_WANTED_KEY) === '1' } catch { return false }
}

export function markThumbsWanted(storage: Pick<Storage, 'setItem'> | undefined, notify?: (name: string) => void) {
  try { storage?.setItem(THUMBS_WANTED_KEY, '1') } catch { /* blocked storage: previews just stay off */ }
  notify?.(THUMBS_WANTED_EVENT)
}
