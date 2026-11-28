/** How a savings goal is pacing against its target date. Pure; all dates are local ISO yyyy-mm-dd. */
export interface GoalPace {
  state: 'done' | 'no-date' | 'overdue' | 'running'
  daysLeft: number
  remaining: number
  /** Dollars per week needed to land on the target date (0 when done or no date). */
  perWeek: number
  /** True when the per-period funding already covers the weekly need (only meaningful when fundedPerWeek is given). */
  onTrack: boolean | null
}

const DAY = 864e5
const parse = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, (m || 1) - 1, d || 1) }

export function goalPace(g: { targetAmount: number; contributedAmount: number; targetDate?: string }, todayIso: string, fundedPerWeek?: number): GoalPace {
  const remaining = Math.max(0, Math.round((g.targetAmount - g.contributedAmount) * 100) / 100)
  if (g.targetAmount > 0 && remaining === 0) return { state: 'done', daysLeft: 0, remaining: 0, perWeek: 0, onTrack: true }
  if (!g.targetDate) return { state: 'no-date', daysLeft: 0, remaining, perWeek: 0, onTrack: null }
  const daysLeft = Math.round((parse(g.targetDate) - parse(todayIso)) / DAY)
  if (daysLeft <= 0) return { state: 'overdue', daysLeft, remaining, perWeek: 0, onTrack: false }
  const perWeek = Math.ceil((remaining / (daysLeft / 7)) * 100) / 100
  return { state: 'running', daysLeft, remaining, perWeek, onTrack: fundedPerWeek === undefined ? null : fundedPerWeek + 1e-9 >= perWeek }
}

/** Highest milestone crossed: 25, 50, 75 or 100 (0 below 25%). */
export function milestone(progressPct: number): 0 | 25 | 50 | 75 | 100 {
  return progressPct >= 100 ? 100 : progressPct >= 75 ? 75 : progressPct >= 50 ? 50 : progressPct >= 25 ? 25 : 0
}
