import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

// A tiled, short browser window (about 340px of page height) used to hide the keys 7-0 below the fold with no way to scroll.
// Every key must be fully on screen, and a mouse/touch user must be able to unlock. The PIN is read from the app's source (never printed); local preview only.
const PIN = readFileSync('src/lib/constants.ts', 'utf8').match(/CLARITY_PIN\s*=\s*['"](\d{4})['"]/)?.[1] ?? ''
test.use({ reducedMotion: 'reduce' })
const quiet = () => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } }

for (const [w, h] of [[701, 340], [346, 340], [346, 421], [390, 844], [1440, 900]] as const) {
  test(`PIN keypad is fully reachable with the mouse at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await page.addInitScript(quiet)
    await page.goto('./?tab=budgets')
    await expect(page.getByText('Enter your PIN')).toBeVisible()
    const off = await page.evaluate(() => [...document.querySelectorAll('button')]
      .filter((b) => /^[0-9]$/.test((b.textContent || '').trim()) || b.getAttribute('aria-label') === 'Backspace')
      .filter((b) => { const r = b.getBoundingClientRect(); return r.top < 0 || r.bottom > window.innerHeight || r.left < 0 || r.right > window.innerWidth })
      .map((b) => (b.textContent || 'BS').trim() || 'BS'))
    expect(off, `keys not fully on screen at ${w}x${h}`).toEqual([])
    await page.waitForTimeout(3500) // let the first-launch intro finish (it swallows the first click)
    for (const d of PIN) { await page.getByRole('button', { name: d, exact: true }).click(); await page.waitForTimeout(120) }
    await expect(page.getByText('Enter your PIN')).toHaveCount(0, { timeout: 10000 })
    await expect(page.locator('body')).not.toBeEmpty()
  })
}
