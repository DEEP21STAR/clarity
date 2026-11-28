import { RELEASE } from '../src/lib/whatsNew'
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// the one-time "What's new" card would take the notice slot, so mark this release as already seen
test.beforeEach(async ({ page }) => { await page.addInitScript((id) => { try { localStorage.setItem('clarity-whatsnew-seen', id) } catch { /* ignore */ } }, RELEASE.id) })

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const ago = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d }
const tx = (n: number) => ({ id: 'sp' + n, date: iso(ago(n % 20)), description: 'Groceries', amount: -25, category: 'Food', mode: 'personal' })
// recently backed up so the backup reminder does not take the slot
const USED = { grossAnnualIncome: 90000, country: 'NZ', lastExportedAt: new Date().toISOString(), transactions: Array.from({ length: 12 }, (_, i) => tx(i + 1)) }
const memory = (daysAgoFirst: number, extra: object = {}) => JSON.stringify({ firstSeen: iso(ago(daysAgoFirst)), lastAsked: null, dismissals: 0, supported: null, ...extra })

async function open(page: Page, width: number, seed: object, mem: string | null, tab = 'dashboard') {
  await page.setViewportSize({ width, height: 900 })
  await page.addInitScript(([s, m]) => { try { sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)); if (!sessionStorage.getItem('seeded')) { localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)); if (m) localStorage.setItem('clarity-support-v1', m); sessionStorage.setItem('seeded', '1') } } catch { /* ignore */ } }, [seed, mem] as const)
  await page.goto(`./?tab=${tab}`)
}

test('a brand-new user is never asked', async ({ page }) => {
  await open(page, 1440, USED, null)
  await page.waitForTimeout(800)
  await expect(page.getByTestId('support-nudge')).toHaveCount(0)
})

test('after the first week and real use it shows once, with the shared coffee link, and is tap-sized with no axe violations', async ({ page }) => {
  await open(page, 390, USED, memory(10), 'home')
  const strip = page.getByTestId('support-nudge')
  await expect(strip).toBeVisible()
  await expect(strip.getByRole('link', { name: /Buy me a coffee/ })).toHaveAttribute('href', 'https://buymeacoffee.com/nutryos')
  for (const el of [...(await strip.getByRole('button').all()), ...(await strip.getByRole('link').all())]) expect((await el.boundingBox())!.height, 'tap size').toBeGreaterThanOrEqual(44)
  const r = await new AxeBuilder({ page }).include('[data-testid="support-nudge"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(r.violations.map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 140)}`)).toEqual([])
})

test('"Not now" hides it, it stays hidden after a reload, and the answer is remembered', async ({ page }) => {
  await open(page, 1440, USED, memory(10))
  await page.getByTestId('support-nudge').getByRole('button', { name: 'Not now' }).click()
  await expect(page.getByTestId('support-nudge')).toHaveCount(0)
  await page.reload()
  await page.waitForTimeout(600)
  await expect(page.getByTestId('support-nudge')).toHaveCount(0)
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('clarity-support-v1') || '{}'))
  expect(saved.dismissals).toBe(1)
})

test('the backup reminder wins the slot: only one notice at a time', async ({ page }) => {
  await open(page, 1440, { ...USED, lastExportedAt: undefined }, memory(10))
  await expect(page.getByTestId('backup-nudge')).toBeVisible()
  await expect(page.getByTestId('support-nudge')).toHaveCount(0)
})

test('a damaged saved value cannot break the page', async ({ page }) => {
  await open(page, 1440, USED, '{{{not json')
  await page.waitForTimeout(800)
  await expect(page.getByRole('heading', { name: /Dashboard/i }).first()).toBeVisible()
  await expect(page.getByTestId('support-nudge')).toHaveCount(0)
})
