/**
 * Small vibration cues on touch phones: a light tick for taps, a double pulse for something done, a firmer one for a warning.
 * Off on desktops (no touch), off under reduced motion, off if the browser has no vibration API (iOS Safari), and switchable with
 * localStorage 'clarity-haptics' = 'off'.
 */
export type HapticKind = 'tap' | 'success' | 'warn'

const PATTERNS: Record<HapticKind, number | number[]> = { tap: 8, success: [10, 40, 16], warn: [24, 50, 24] }
export const HAPTICS_KEY = 'clarity-haptics'

export interface HapticEnv { hasVibrate: boolean; coarsePointer: boolean; reducedMotion: boolean; enabled: boolean }

export function hapticPattern(kind: HapticKind, env: HapticEnv): number | number[] | null {
  if (!env.hasVibrate || !env.coarsePointer || env.reducedMotion || !env.enabled) return null
  return PATTERNS[kind]
}

export function currentHapticEnv(): HapticEnv {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return { hasVibrate: false, coarsePointer: false, reducedMotion: false, enabled: false }
  let enabled = true
  try { enabled = window.localStorage.getItem(HAPTICS_KEY) !== 'off' } catch { /* blocked storage: leave on */ }
  return {
    hasVibrate: typeof navigator.vibrate === 'function',
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    enabled,
  }
}

export function haptic(kind: HapticKind) {
  const p = hapticPattern(kind, currentHapticEnv())
  if (p === null) return
  try { navigator.vibrate(p) } catch { /* some browsers throw without a recent tap: ignore */ }
}
