/** How a savings goal is pacing against its target date. Pure; all dates are local ISO yyyy-mm-dd; money is handled in whole cents. */
export interface GoalPace {
  state: 'done' | 'no-date' | 'overdue' | 'due-today' | 'running'
  daysLeft: number
  remaining: number
  /** Dollars per week to land on the target date; 0 unless state is 'running' and a week or more is left. */
  perWeek: number
  /** Under a week left: show "$X still to go by <date>" instead of a (misleading) weekly figure. */
  short: boolean
  onTrack: boolean | null
}

const DAY = 864e5
function parse(iso: unknown): number | null {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d)
  const back = new Date(t)
  return back.getUTCFullYear() === y && back.getUTCMonth() === m - 1 && back.getUTCDate() === d ? t : null
}
export const validIsoDate = (iso: unknown): boolean => parse(iso) !== null
const cents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100)

export function goalPace(g: { targetAmount: number; contributedAmount: number; targetDate?: string }, todayIso: string, fundedPerWeek?: number): GoalPace {
  const remC = Math.max(0, cents(g.targetAmount) - cents(g.contributedAmount))
  const remaining = remC / 100
  const base = { remaining, perWeek: 0, short: false, onTrack: null as boolean | null }
  if (cents(g.targetAmount) > 0 && remC === 0) return { ...base, state: 'done', daysLeft: 0, onTrack: true }
  const target = parse(g.targetDate), today = parse(todayIso)
  if (cents(g.targetAmount) <= 0 || target === null || today === null) return { ...base, state: 'no-date', daysLeft: 0 }
  const daysLeft = Math.round((target - today) / DAY)
  if (daysLeft < 0) return { ...base, state: 'overdue', daysLeft, onTrack: false }
  if (daysLeft === 0) return { ...base, state: 'due-today', daysLeft }
  if (daysLeft < 7) return { ...base, state: 'running', daysLeft, short: true }
  const perWeekC = Math.ceil((remC * 7) / daysLeft)
  const perWeek = perWeekC / 100
  return { ...base, state: 'running', daysLeft, perWeek, onTrack: fundedPerWeek === undefined ? null : cents(fundedPerWeek) >= perWeekC }
}

/** Highest milestone crossed: 25, 50, 75 or 100 (0 below 25%). Pass the same rounded percentage the bar shows. */
export function milestone(progressPct: number): 0 | 25 | 50 | 75 | 100 {
  return progressPct >= 100 ? 100 : progressPct >= 75 ? 75 : progressPct >= 50 ? 50 : progressPct >= 25 ? 25 : 0
}
