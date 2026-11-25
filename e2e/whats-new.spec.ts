import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { RELEASE } from '../src/lib/whatsNew'

// One-time "What's new" card: first in the notice slot, dismissible, never for an empty app, links open real screens.
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const ago = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d }
const WITH_DATA = { grossAnnualIncome: 90000, country: 'NZ', transactions: [1, 2, 3].map((n) => ({ id: 'wn' + n, date: iso(ago(n)), description: 'Groceries', amount: -25, category: 'Food', mode: 'personal' })) }

async function open(page: Page, width: number, seed: object, tab = 'dashboard', seen?: string) {
  await page.setViewportSize({ width, height: 900 })
  await page.addInitScript(([s, id]) => { try { sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)); if (id) localStorage.setItem('clarity-whatsnew-seen', id as string); if (!sessionStorage.getItem('seeded')) { localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)); sessionStorage.setItem('seeded', '1') } } catch { /* ignore */ } }, [seed, seen ?? ''] as const)
  await page.goto(`./?tab=${tab}`)
}

test('shows the release list once, then the backup reminder takes the slot after Got it, and it stays gone after a reload', async ({ page }) => {
  await open(page, 1440, WITH_DATA)
  const card = page.getByTestId('whats-new')
  await expect(card).toBeVisible()
  expect(await card.locator('li').count()).toBe(RELEASE.items.length)
  await expect(page.getByTestId('backup-nudge'), 'one notice at a time').toHaveCount(0)
  await card.getByRole('button', { name: 'Got it' }).click()
  await expect(page.getByTestId('whats-new')).toHaveCount(0)
  await expect(page.getByTestId('backup-nudge')).toBeVisible()
  await page.reload()
  await page.waitForTimeout(800)
  await expect(page.getByTestId('whats-new')).toHaveCount(0)
})

test('"Open Budgets" and "Open Net Worth" go to those screens', async ({ page }) => {
  await open(page, 1440, WITH_DATA)
  await page.getByTestId('whats-new').getByRole('button', { name: /open Budgets/ }).click()
  await expect(page.getByText('Category Budgets').first()).toBeVisible()
  await page.goto('./?tab=dashboard')
  await page.getByTestId('whats-new').getByRole('button', { name: /open Net Worth/ }).click()
  await expect(page.getByText(/Next 6 months, at this pace/).first()).toBeVisible()
})

test('hidden for an empty app and once this release was seen', async ({ page, browser }) => {
  await open(page, 1440, { grossAnnualIncome: 90000, country: 'NZ' })
  await page.waitForTimeout(800)
  await expect(page.getByTestId('whats-new'), 'empty app').toHaveCount(0)
  const p2 = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', baseURL: process.env.PW_BASE ?? 'http://127.0.0.1:4173/clarity/' })).newPage()
  await p2.addInitScript(([s, id]) => { try { sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)); localStorage.setItem('clarity-whatsnew-seen', id as string); localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)) } catch { /* ignore */ } }, [WITH_DATA, RELEASE.id] as const)
  await p2.goto('./?tab=dashboard')
  await p2.waitForTimeout(800)
  await expect(p2.getByTestId('whats-new'), 'already seen').toHaveCount(0)
})

test('on a phone it fits at 320px, buttons are tap-sized, and axe finds nothing', async ({ page }) => {
  await open(page, 320, WITH_DATA, 'home')
  const card = page.getByTestId('whats-new')
  await expect(card).toBeVisible()
  const right = await card.evaluate((e) => [...e.querySelectorAll('*')].map((c) => c.getBoundingClientRect().right).reduce((a, b) => Math.max(a, b), 0))
  expect(right).toBeLessThanOrEqual(321)
  for (const b of await card.getByRole('button').all()) expect((await b.boundingBox())!.height, 'tap-sized').toBeGreaterThanOrEqual(40)
  expect((await card.boundingBox())!.height, 'a compact card on a 320px phone').toBeLessThan(430)
  await card.scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/whats-new-320.png' })
  const r = await new AxeBuilder({ page }).include('[data-testid="whats-new"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(r.violations.map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 160)}`)).toEqual([])
})
