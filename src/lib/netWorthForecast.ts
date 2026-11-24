/**
 * "At this pace": net worth month by month if each month keeps adding what is left after income and bills, as it does now.
 * It is arithmetic on figures already in the app, not a prediction: no interest, no investment growth, no spending outside the bills
 * list, and debt payments inside the bills count as money out. The screen says so.
 */
export interface ForecastPoint { monthsAhead: number; label: string; value: number }
export interface NetWorthForecast { points: ForecastPoint[]; monthlyChange: number; start: number; end: number; change: number }

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const round2 = (n: number) => Math.round(n * 100) / 100

function monthLabel(todayIso: string, ahead: number): string {
  const [y, m] = todayIso.slice(0, 10).split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + ahead, 1))
  return d.toLocaleDateString('en-NZ', { month: 'short', timeZone: 'UTC' })
}

export function forecastNetWorth(args: { netWorthNow: number; monthlyNetIncome: number; monthlyBills: number; todayIso: string; months?: number }): NetWorthForecast | null {
  const { netWorthNow, monthlyNetIncome, monthlyBills, todayIso } = args
  const months = Math.max(1, Math.min(24, Math.floor(args.months ?? 6)))
  if (!finite(netWorthNow) || !finite(monthlyNetIncome) || !finite(monthlyBills) || monthlyNetIncome <= 0) return null
  if (!/^\d{4}-\d{2}-\d{2}/.test(todayIso)) return null
  const monthlyChange = round2(monthlyNetIncome - Math.max(0, monthlyBills))
  const points: ForecastPoint[] = []
  for (let i = 0; i <= months; i++) points.push({ monthsAhead: i, label: i === 0 ? 'Now' : monthLabel(todayIso, i), value: round2(netWorthNow + monthlyChange * i) })
  return { points, monthlyChange, start: points[0].value, end: points[months].value, change: round2(points[months].value - points[0].value) }
}
