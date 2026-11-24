/**
 * Loads the screens you have not opened yet, one at a time while the browser is idle, so the first tap on a tab does not wait for its code
 * to download and run (Predator measured a 440-470 ms stall the first time Budgets opened). Skipped on data-saver and slow connections,
 * and a failed load is ignored: the tab simply loads when you open it, as before.
 */
export type Loader = () => Promise<unknown>

interface NetInfo { saveData?: boolean; effectiveType?: string }

export function shouldPrefetch(nav: { connection?: NetInfo } | undefined = typeof navigator === 'undefined' ? undefined : (navigator as unknown as { connection?: NetInfo })): boolean {
  const c = nav?.connection
  if (!c) return true
  if (c.saveData) return false
  return !['slow-2g', '2g', '3g'].includes(c.effectiveType ?? '')
}

type Idle = (cb: () => void) => void
const defaultIdle: Idle = (cb) => {
  const w = typeof window !== 'undefined' ? (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }) : undefined
  if (w?.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 4000 })
  else setTimeout(cb, 1500)
}

/** Starts the prefetch queue after `startDelayMs`; returns a function that stops it. Loaders run strictly one after another. */
export function schedulePrefetch(loaders: readonly Loader[], opts: { startDelayMs?: number; gapMs?: number; idle?: Idle; allowed?: boolean } = {}): () => void {
  const { startDelayMs = 3000, gapMs = 1200, idle = defaultIdle, allowed = shouldPrefetch() } = opts
  if (!allowed) return () => {}
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let i = 0
  const next = () => {
    if (stopped || i >= loaders.length) return
    idle(() => {
      if (stopped) return
      const load = loaders[i++]
      Promise.resolve().then(load).catch(() => { /* the tab loads on demand instead */ }).finally(() => { if (!stopped) timer = setTimeout(next, gapMs) })
    })
  }
  timer = setTimeout(next, startDelayMs)
  return () => { stopped = true; if (timer) clearTimeout(timer) }
}
