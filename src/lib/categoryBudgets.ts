import type { Transaction } from './types'

/** A monthly target for one spending category. Rollover is OFF by default: when on, last month's unspent amount carries forward. */
export interface CategoryBudget { monthly: number; rollover?: boolean }
export type CategoryBudgets = Record<string, CategoryBudget>
export type BudgetStatus = 'unset' | 'ok' | 'watch' | 'over'

export interface BudgetRow {
  category: string
  monthly: number          // the target you set (0 when none)
  carry: number            // unspent last month carried in (rollover only)
  target: number           // monthly + carry
  spent: number            // spend so far this month
  remaining: number        // target - spent (can be negative)
  pctSpent: number         // spent / target, 0..many (0 when no target)
  pacePct: number          // how far through the month we are, 0..1
  status: BudgetStatus
  daysLeft: number         // days remaining after today
  perDayLeft: number       // what you can spend each remaining day (incl. today) to land on target
  suggested: number | null // a target suggested from your own history, if there is any
  rollover: boolean
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function monthOf(iso: string): string { return iso.slice(0, 7) }
export function daysInMonth(monthIso: string): number {
  const [y, m] = monthIso.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}
export function previousMonth(monthIso: string): string {
  const [y, m] = monthIso.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function spentInMonth(txs: readonly Transaction[], category: string, monthIso: string): number {
  let s = 0
  for (const t of txs) if (t.amount < 0 && t.category === category && monthOf(t.date) === monthIso) s -= t.amount
  return round2(s)
}
function hasAnyIn(txs: readonly Transaction[], monthIso: string): boolean {
  return txs.some((t) => monthOf(t.date) === monthIso)
}

/** A target suggested from the last up-to-3 months that have spend in this category, rounded up to a tidy $10. Null with no history. */
export function suggestTarget(txs: readonly Transaction[], category: string, todayIso: string): number | null {
  const totals: number[] = []
  let m = previousMonth(monthOf(todayIso))
  for (let i = 0; i < 3; i++) {
    const s = spentInMonth(txs, category, m)
    if (s > 0) totals.push(s)
    m = previousMonth(m)
  }
  if (totals.length === 0) return null
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length
  return Math.max(10, Math.ceil(avg / 10) * 10)
}

export function computeBudgetRows(budgets: CategoryBudgets, txs: readonly Transaction[], todayIso: string, extraCategories: readonly string[] = []): BudgetRow[] {
  const month = monthOf(todayIso)
  const dim = daysInMonth(month)
  const day = Math.min(dim, Math.max(1, Number(todayIso.slice(8, 10)) || 1))
  const pacePct = day / dim
  const prev = previousMonth(month)
  const prevHasData = hasAnyIn(txs, prev)

  const names = new Set<string>(Object.keys(budgets))
  for (const t of txs) if (t.amount < 0 && monthOf(t.date) === month && t.category && t.category !== 'uncategorised') names.add(t.category)
  for (const c of extraCategories) if (c && c !== 'uncategorised') names.add(c)

  const rows: BudgetRow[] = [...names].map((category) => {
    const b = budgets[category]
    const monthly = b && b.monthly > 0 ? b.monthly : 0
    const rollover = !!b?.rollover
    const carry = rollover && monthly > 0 && prevHasData ? Math.max(0, round2(monthly - spentInMonth(txs, category, prev))) : 0
    const target = round2(monthly + carry)
    const spent = spentInMonth(txs, category, month)
    const remaining = round2(target - spent)
    const pctSpent = target > 0 ? spent / target : 0
    const daysLeft = dim - day
    let status: BudgetStatus = 'unset'
    if (target > 0) status = spent > target ? 'over' : pctSpent >= 0.9 || pctSpent > pacePct + 0.1 ? 'watch' : 'ok'
    return {
      category, monthly, carry, target, spent, remaining, pctSpent, pacePct, status, daysLeft,
      perDayLeft: target > 0 && remaining > 0 ? round2(remaining / (daysLeft + 1)) : 0,
      suggested: monthly > 0 ? null : suggestTarget(txs, category, todayIso),
      rollover,
    }
  })

  const rank: Record<BudgetStatus, number> = { over: 0, watch: 1, ok: 2, unset: 3 }
  return rows.sort((a, b) => rank[a.status] - rank[b.status] || b.spent - a.spent || a.category.localeCompare(b.category))
}

/** Sets or clears one category's target, returning a new map. A target of 0 or less removes the budget. */
export function withBudget(budgets: CategoryBudgets, category: string, patch: Partial<CategoryBudget>): CategoryBudgets {
  const next = { ...budgets }
  const merged = { ...next[category], ...patch } as CategoryBudget
  if (!(merged.monthly > 0)) delete next[category]
  else next[category] = { monthly: round2(merged.monthly), ...(merged.rollover ? { rollover: true } : {}) }
  return next
}

/** What trimming a monthly target by `pct` (default 10%) would free up. Pure arithmetic on the target, rounded to cents. */
export function trimSaving(monthly: number, pct = 0.1): { perMonth: number; perYear: number } | null {
  if (!(monthly > 0) || !(pct > 0) || pct >= 1) return null
  const perMonth = Math.round(monthly * pct * 100) / 100
  return { perMonth, perYear: Math.round(perMonth * 12 * 100) / 100 }
}
