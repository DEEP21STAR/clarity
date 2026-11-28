import { RELEASE } from '../src/lib/whatsNew'
import { test, expect } from '@playwright/test'

// The big Live Funds amount (including the overspent, negative case) must fit inside its card at every phone width,
// and the header logo must keep its shape (it once squeezed flat at 320px).
for (const w of [320, 360, 390, 400, 430]) test(`overspent hero amount fits its card and the header star keeps its size at ${w}px`, async ({ page }) => {
  await page.setViewportSize({ width: w, height: 800 })
  await page.addInitScript(([id]) => { try { localStorage.setItem('clarity-whatsnew-seen', id); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)); localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify({ grossAnnualIncome: 90000, country: 'NZ' })) } catch { /* ignore */ } }, [RELEASE.id] as const)
  await page.goto('./?tab=upcoming')
  await page.waitForTimeout(2200)
  const res = await page.evaluate(() => {
    const para = [...document.querySelectorAll('p')].find((x) => /Live Funds Available/i.test(x.textContent || ''))
    let card = para?.parentElement?.parentElement as HTMLElement | undefined
    while (card && !/rounded/.test(card.className.toString()) && card.parentElement) card = card.parentElement
    const cb = card!.getBoundingClientRect(), amount = [...card!.querySelectorAll('span')].find((e) => /\$/.test(e.textContent || '') && e.children.length === 0)!.getBoundingClientRect()
    const logo = document.querySelector('[data-brand-logo]')!.getBoundingClientRect()
    return { cardRight: cb.right, amountRight: amount.right, amountLeft: amount.left, cardLeft: cb.left, logoW: logo.width, logoH: logo.height }
  })
  expect(res.amountRight, 'amount stays inside the card').toBeLessThanOrEqual(res.cardRight - 8)
  expect(res.amountLeft, 'amount starts inside the card').toBeGreaterThanOrEqual(res.cardLeft + 8)
  if (w < 400) expect(res.logoW, 'below 400px the header has no room, so the star is hidden rather than squeezed over the profile pill').toBe(0)
  else { expect(Math.round(res.logoW), 'header star is square, not squeezed flat').toBe(Math.round(res.logoH)); expect(res.logoW, 'header star is a sensible size').toBeGreaterThanOrEqual(28) }
})
