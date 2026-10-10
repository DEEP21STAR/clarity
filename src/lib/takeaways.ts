/**
 * Takeaway savings tracker. Self-contained (own localStorage key), deliberately independent of
 * the financial store so it can never affect budgets or the health score. Every figure here is an
 * ESTIMATE from three numbers the user enters (or pastes from NUTRYOS): takeaway-free days, what
 * a typical takeaway costs, and how many they used to have per week.
 */

export interface TakeawayState {
  days: number
  asOf: string | null // yyyy-mm-dd the day count was entered/pasted
  cost: number | null
  perWeek: number
}

export const TAKEAWAY_KEY = 'clarity.takeaways.v1'
export const DEFAULT_TAKEAWAY_STATE: TakeawayState = { days: 0, asOf: null, cost: null, perWeek: 2 }

/** Estimated money not spent: days x cost x (perWeek / 7). Null until a cost is known. */
export function savedSoFar(s: TakeawayState): number | null {
  if (s.cost === null || !(s.cost > 0) || !(s.perWeek > 0)) return null
  return Math.round(s.days * s.cost * (s.perWeek / 7) * 100) / 100
}

/** What a full takeaway-free month would save at the user's old habit (52 weeks / 12). */
export function monthlySavingPotential(s: TakeawayState): number | null {
  if (s.cost === null || !(s.cost > 0) || !(s.perWeek > 0)) return null
  return Math.round(s.cost * s.perWeek * (52 / 12) * 100) / 100
}

/** Parses a code copied from NUTRYOS: NUTRYOS-TF:<days>:<yyyy-mm-dd>[:<cost>[:<perWeek>]]. */
export function parseNutryosCode(raw: string): Partial<TakeawayState> | null {
  const m = raw.trim().match(/^NUTRYOS-TF:(\d{1,4}):(\d{4}-\d{2}-\d{2})(?::(\d*\.?\d*))?(?::(\d*\.?\d*))?$/)
  if (!m) return null
  const out: Partial<TakeawayState> = { days: Number(m[1]), asOf: m[2] }
  const cost = m[3] ? Number(m[3]) : NaN
  const perWeek = m[4] ? Number(m[4]) : NaN
  if (Number.isFinite(cost) && cost > 0) out.cost = cost
  if (Number.isFinite(perWeek) && perWeek > 0 && perWeek <= 21) out.perWeek = perWeek
  return out
}

export function loadTakeaways(): TakeawayState {
  try {
    const raw = localStorage.getItem(TAKEAWAY_KEY)
    if (!raw) return { ...DEFAULT_TAKEAWAY_STATE }
    const p = JSON.parse(raw) as Partial<TakeawayState>
    return {
      days: Number.isFinite(p.days) && (p.days as number) >= 0 ? (p.days as number) : 0,
      asOf: typeof p.asOf === 'string' ? p.asOf : null,
      cost: Number.isFinite(p.cost) && (p.cost as number) > 0 ? (p.cost as number) : null,
      perWeek: Number.isFinite(p.perWeek) && (p.perWeek as number) > 0 ? (p.perWeek as number) : 2,
    }
  } catch {
    return { ...DEFAULT_TAKEAWAY_STATE }
  }
}

export function saveTakeaways(s: TakeawayState) {
  try {
    localStorage.setItem(TAKEAWAY_KEY, JSON.stringify(s))
  } catch {
    // storage blocked: figures just won't persist
  }
}
