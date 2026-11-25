import { RELEASE } from '../src/lib/whatsNew'
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// the one-time "What's new" card would take the notice slot these tests look at, so mark this release as already seen
test.beforeEach(async ({ page }) => { await page.addInitScript((id) => { try { localStorage.setItem('clarity-whatsnew-seen', id) } catch { /* ignore */ } }, RELEASE.id) })

// Backup reminder on Home (phone) and Dashboard. Shows only when there is data to lose and no backup in 30+ days.
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const ago = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d }
const tx = (n: number) => ({ id: 'bk' + n, date: iso(ago(n)), description: 'Groceries', amount: -25, category: 'Food', mode: 'personal' })
const WITH_DATA = { grossAnnualIncome: 90000, country: 'NZ', transactions: [tx(1), tx(2), tx(3)] }

async function open(page: Page, width: number, seed: object, tab = 'dashboard') {
  await page.setViewportSize({ width, height: 900 })
  await page.addInitScript((s) => { try { sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)); if (!sessionStorage.getItem('seeded')) { localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)); sessionStorage.setItem('seeded', '1') } } catch { /* ignore */ } }, seed)
  await page.goto(`./?tab=${tab}`)
}

test('shows on the Dashboard when data was never backed up, and Back up now opens Tools', async ({ page }) => {
  await open(page, 1440, WITH_DATA)
  const strip = page.getByTestId('backup-nudge')
  await expect(strip).toBeVisible()
  await expect(strip).toContainText('never been backed up')
  await strip.getByRole('button', { name: 'Back up now' }).click()
  await expect(page.getByText(/Data last exported/)).toBeVisible()
})

test('shows on phone Home too, fits at 320px, and has no axe violations', async ({ page }) => {
  await open(page, 320, WITH_DATA, 'home')
  const strip = page.getByTestId('backup-nudge')
  await expect(strip).toBeVisible()
  const right = await strip.evaluate((e) => [...e.querySelectorAll('*')].map((c) => c.getBoundingClientRect().right).reduce((a, b) => Math.max(a, b), 0))
  expect(right).toBeLessThanOrEqual(321)
  for (const b of await strip.getByRole('button').all()) expect((await b.boundingBox())!.height, 'buttons are tap-sized').toBeGreaterThanOrEqual(40)
  await page.screenshot({ path: 'test-results/backup-nudge-320.png' })
  const r = await new AxeBuilder({ page }).include('[data-testid="backup-nudge"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(r.violations.map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 160)}`)).toEqual([])
})

test('Remind me next week hides it, and it stays hidden after a reload', async ({ page }) => {
  await open(page, 1440, WITH_DATA)
  await page.getByTestId('backup-nudge').getByRole('button', { name: 'Remind me next week' }).click()
  await expect(page.getByTestId('backup-nudge')).toHaveCount(0)
  await page.reload()
  await page.waitForTimeout(800)
  await expect(page.getByTestId('backup-nudge')).toHaveCount(0)
})

test('stays hidden for an empty app and after a recent backup', async ({ page, browser }) => {
  await open(page, 1440, { grossAnnualIncome: 90000, country: 'NZ' })
  await page.waitForTimeout(800)
  await expect(page.getByTestId('backup-nudge'), 'empty app').toHaveCount(0)
  const p2 = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', baseURL: process.env.PW_BASE ?? 'http://127.0.0.1:4173/clarity/' })).newPage()
  await p2.addInitScript((s) => { try { localStorage.setItem('clarity-whatsnew-seen', s.__rel); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)); localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)) } catch { /* ignore */ } }, { ...WITH_DATA, lastExportedAt: new Date().toISOString(), __rel: RELEASE.id })
  await p2.goto('./?tab=dashboard')
  await p2.waitForTimeout(800)
  await expect(p2.getByTestId('backup-nudge'), 'recent backup').toHaveCount(0)
})

test('says how many days when the last backup is old', async ({ page }) => {
  await open(page, 1440, { ...WITH_DATA, lastExportedAt: ago(45).toISOString() })
  await expect(page.getByTestId('backup-nudge')).toContainText('The last backup was 45 days ago')
})
