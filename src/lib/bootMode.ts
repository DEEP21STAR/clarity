/**
 * How much of the boot splash to play. The full particle splash is the brand moment, but playing it on EVERY
 * launch costs seconds each time. It plays in full on the first launch ever and again after a long gap;
 * a relaunch within the window gets a brief wordmark fade. Reduced-motion users never get the long one,
 * and ?splash=full forces it (demos, screenshots).
 */
export type BootMode = 'full' | 'quick'

export const BOOT_KEY = 'clarity-last-boot'
export const FULL_SPLASH_GAP_MS = 6 * 60 * 60 * 1000

export function chooseBootMode(opts: { now: number; lastBoot: number | null; reduceMotion?: boolean; force?: 'full' | 'quick' | null }): BootMode {
  if (opts.force === 'full' || opts.force === 'quick') return opts.force
  if (opts.reduceMotion) return 'quick'
  if (opts.lastBoot == null || !Number.isFinite(opts.lastBoot)) return 'full'
  const gap = opts.now - opts.lastBoot
  if (gap < 0) return 'full' // clock went backwards: do not trust it
  return gap >= FULL_SPLASH_GAP_MS ? 'full' : 'quick'
}

export function readLastBoot(storage: Pick<Storage, 'getItem'> | undefined): number | null {
  try {
    const raw = storage?.getItem(BOOT_KEY)
    if (raw == null) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch { return null }
}

export function writeLastBoot(storage: Pick<Storage, 'setItem'> | undefined, now: number) {
  try { storage?.setItem(BOOT_KEY, String(now)) } catch { /* private mode / blocked storage: just play the full splash next time */ }
}

/** The greeting on the intro: time-of-day aware, using the name on the profile. Late night and a missing name fall back gracefully. */
export function greetingFor(hour: number, name: string | undefined | null): string {
  const n = (name ?? '').trim()
  const word = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 18 ? 'Good afternoon' : hour >= 18 && hour < 22 ? 'Good evening' : 'Welcome back'
  return n ? `${word}, ${n}` : word
}
