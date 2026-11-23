import { test, expect } from '@playwright/test'
import { VIEWPORTS } from './support/app'

// "Your week": a slim one-line row while there is nothing to review, the full card once there is spending in the last 7 days.
test.use({ reducedMotion: 'reduce' })
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }
const tx = (id: string, date: string, amount: number, category: string) => ({ id, date, amount, description: category, category, mode: 'personal' })
const seedPage = (page: import('@playwright/test').Page, seed: object) => page.addInitScript((s) => { try { if (!sessionStorage.getItem('e2e-seeded')) { localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)); sessionStorage.setItem('e2e-seeded', '1') } sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } }, seed)

for (const [name, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`your week @ ${name}`, () => {
    test.use({ viewport: vp })
    test('empty state is one slim row that still tells you what to do', async ({ page }) => {
      await seedPage(page, {})
      await page.goto('./?tab=dashboard')
      const card = page.getByRole('region', { name: 'Your week' })
      await expect(card).toContainText('Import a bank statement')
      const box = await card.boundingBox()
      // desktop fits on one or two text lines; a phone wraps to a few. Either way it must be far shorter than the old tall card.
      expect(box!.height).toBeLessThan(name === 'desktop' ? 60 : 125)
      await card.screenshot({ path: `test-results/yourweek-empty-${name}.png` })
    })

    test('with spending it shows the full card with real figures', async ({ page }) => {
      // $60 + $40 in the last week; nothing the week before: "You spent $100 in the last 7 days." and Groceries is the top category ($60)
      await seedPage(page, { transactions: [tx('a', daysAgo(1), -60, 'Groceries'), tx('b', daysAgo(2), -40, 'Fuel')] })
      await page.goto('./?tab=dashboard')
      const card = page.getByRole('region', { name: 'Your week' })
      await expect(card).toContainText('You spent $100 in the last 7 days')
      await expect(card).toContainText('Most of it went on Groceries ($60)')
    })
  })
}
