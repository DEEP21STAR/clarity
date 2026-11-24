/**
 * Where a month's income goes: bills by category, then what is left. Pure arithmetic on numbers already in the app.
 * When bills are more than income the right side is taller than the left, and the difference is shown as a "Shortfall" on the left.
 */
export interface FlowPart { name: string; value: number; color: string }
export interface MoneyFlow {
  income: number
  bills: number
  parts: FlowPart[]      // right side, top to bottom: bill categories (largest first), then Leftover
  leftover: number       // >= 0
  shortfall: number      // >= 0, bills beyond income
  total: number          // height of both columns: max(income, bills)
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

export function buildMoneyFlow(netMonthlyIncome: number, billParts: readonly FlowPart[], leftoverColor = '#22d3ee'): MoneyFlow | null {
  const income = finite(netMonthlyIncome) && netMonthlyIncome > 0 ? netMonthlyIncome : 0
  const cats = billParts.filter((p) => p && finite(p.value) && p.value > 0).sort((a, b) => b.value - a.value)
  const bills = cats.reduce((s, p) => s + p.value, 0)
  if (income <= 0 || bills <= 0) return null
  const leftover = Math.max(0, income - bills)
  const parts = leftover > 0 ? [...cats, { name: 'leftover', value: leftover, color: leftoverColor }] : cats
  return { income, bills, parts, leftover, shortfall: Math.max(0, bills - income), total: Math.max(income, bills) }
}

export interface Band { name: string; color: string; value: number; y0: number; y1: number; ty0: number; ty1: number }

/** Vertical positions (0..height) for each ribbon: where it leaves the income column (y0..y1) and where it lands (ty0..ty1). */
export function flowBands(flow: MoneyFlow, height: number, gap = 3): Band[] {
  const gaps = Math.max(0, flow.parts.length - 1) * gap
  const k = (height - gaps) / flow.total
  let sy = 0, ty = 0
  return flow.parts.map((p) => {
    const h = p.value * k
    // source side is one continuous income column (no gaps), target side has small gaps between nodes
    const b = { name: p.name, color: p.color, value: p.value, y0: sy, y1: sy + h, ty0: ty, ty1: ty + h }
    sy += h; ty += h + gap
    return b
  })
}
