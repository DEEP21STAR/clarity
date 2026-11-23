import { formatCurrency } from './utils'

/**
 * The small line under a weekly allocation tile (food / fuel / personal).
 * When the funds behind the allocation are zero or negative the "amount" is zero or negative too, and "$X of -$Y spent" reads as nonsense.
 * In that case say plainly that nothing is set aside. Normal cases keep the original wording.
 */
export function allocationCaption(amount: number, spent: number): string {
  if (!(amount > 0)) {
    // same rounding as the tile's big number (round to cents first), so the two never differ by a cent
    const shortBy = Math.abs(Math.round(amount * 100) / 100)
    return spent > 0
      ? `Nothing set aside this period · ${formatCurrency(spent)} spent`
      : `Short by ${formatCurrency(shortBy)} · nothing set aside this period`
  }
  const remaining = Math.round((amount - spent) * 100) / 100
  const over = remaining < 0
  return `${over ? `${formatCurrency(-remaining)} over ` : ''}${formatCurrency(spent)} of ${formatCurrency(amount)} spent`
}
