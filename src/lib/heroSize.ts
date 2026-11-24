/** "-$12,674.94": the text the big hero amount will show, so its length can pick a text size before it is drawn. */
export function heroAmountText(value: number): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}$${Math.abs(value).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Text size classes for a big money figure that must fit a narrow card. Short amounts keep the full size; longer ones step down
 * (at 320px "-$674.94" fits at text-5xl but "-$12,674.94" does not).
 * `desktopFull` picks the Upcoming hero scale (with md: steps); without it the narrower phone Home hero scale is used.
 */
export function heroAmountSize(value: number, opts: { desktopFull?: boolean } = {}): string {
  const n = heroAmountText(value).length
  if (opts.desktopFull) {
    // Upcoming hero card (md: sizes only matter on wide screens)
    if (n <= 9) return 'text-5xl min-[360px]:text-6xl md:text-8xl'
    if (n <= 11) return 'text-3xl min-[360px]:text-5xl md:text-7xl'
    return 'text-2xl min-[360px]:text-4xl md:text-6xl'
  }
  // Phone Home hero card: narrower, and the figure must stay on one line (about 228px of text width at 320px)
  if (n <= 8) return 'text-5xl'
  if (n <= 9) return 'text-4xl'
  if (n <= 11) return 'text-3xl'
  return 'text-2xl'
}
