/**
 * When to (gently) mention the Buy Me a Coffee page. The rule is "only after Clarity has earned it, and never nag":
 *  - not in the first 7 days after the app was first opened;
 *  - only once the app has real use (10+ transactions, or 3+ bills set up);
 *  - then at most once every 30 days; after two "Not now" answers every 90 days; after four, never again;
 *  - after someone taps the coffee button, stay quiet for a year.
 * Everything is kept on this device. Nothing is sent anywhere.
 */
export interface SupportMemory { firstSeen: string | null; lastAsked: string | null; dismissals: number; supported: string | null }
export const EMPTY_SUPPORT_MEMORY: SupportMemory = { firstSeen: null, lastAsked: null, dismissals: 0, supported: null }

const ISO = /^\d{4}-\d{2}-\d{2}/
const dayNumber = (iso: string) => Math.floor(Date.parse(iso.slice(0, 10) + 'T12:00:00Z') / 86_400_000)
const daysBetween = (fromIso: string, toIso: string) => dayNumber(toIso) - dayNumber(fromIso)

export function supportPrompt(args: { todayIso: string; memory: SupportMemory; transactions: number; bills: number }): boolean {
  const { todayIso, memory, transactions, bills } = args
  if (!ISO.test(todayIso)) return false
  if (memory.supported && ISO.test(memory.supported) && daysBetween(memory.supported, todayIso) < 365) return false
  if (!memory.firstSeen || !ISO.test(memory.firstSeen)) return false
  if (daysBetween(memory.firstSeen, todayIso) < 7) return false
  if (!(transactions >= 10 || bills >= 3)) return false
  if (memory.dismissals >= 4) return false
  if (memory.lastAsked && ISO.test(memory.lastAsked)) {
    const cooldown = memory.dismissals >= 2 ? 90 : 30
    if (daysBetween(memory.lastAsked, todayIso) < cooldown) return false
  }
  return true
}

/** After "Not now". */
export function afterDismiss(memory: SupportMemory, todayIso: string): SupportMemory {
  return { ...memory, lastAsked: todayIso.slice(0, 10), dismissals: memory.dismissals + 1 }
}

/** After the coffee button is tapped. */
export function afterSupport(memory: SupportMemory, todayIso: string): SupportMemory {
  return { ...memory, supported: todayIso.slice(0, 10), lastAsked: todayIso.slice(0, 10) }
}

/** Reads whatever is stored and fixes anything unexpected, so a bad value can never break the app. */
export function readSupportMemory(raw: string | null): SupportMemory {
  try {
    const v = raw ? JSON.parse(raw) : null
    if (!v || typeof v !== 'object') return { ...EMPTY_SUPPORT_MEMORY }
    const iso = (x: unknown) => (typeof x === 'string' && ISO.test(x) ? x.slice(0, 10) : null)
    const n = typeof v.dismissals === 'number' && Number.isFinite(v.dismissals) && v.dismissals >= 0 ? Math.min(Math.floor(v.dismissals), 99) : 0
    return { firstSeen: iso(v.firstSeen), lastAsked: iso(v.lastAsked), dismissals: n, supported: iso(v.supported) }
  } catch { return { ...EMPTY_SUPPORT_MEMORY } }
}
