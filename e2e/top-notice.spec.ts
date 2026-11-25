import { test, expect, type Page } from '@playwright/test'

// One notice at a time above the data, and the first picture before the text blocks (from Predator's design pass).
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const ago = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d }
const SEED = { grossAnnualIncome: 90000, country: 'NZ', transactions: [1, 2, 3].map((n) => ({ id: 'tn' + n, date: iso(ago(n)), description: 'Groceries', amount: -25, category: 'Food', mode: 'personal' })) }

async function open(page: Page, width: number, tab: string) {
  await page.setViewportSize({ width, height: 900 })
  await page.addInitScript(([s, last]) => { try { sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)); if (!sessionStorage.getItem('seeded')) { localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)); localStorage.setItem('clarity-last-visit', last as string); sessionStorage.setItem('seeded', '1') } } catch { /* ignore */ } }, [SEED, iso(ago(5))] as const)
  await page.goto(`./?tab=${tab}`)
}

for (const [w, tab] of [[1440, 'dashboard'], [390, 'home']] as const) {
  test(`${tab} @ ${w}: the visit summary shows alone; hiding it brings the backup reminder`, async ({ page }) => {
    await open(page, w, tab)
    await expect(page.getByTestId('since-last-visit')).toBeVisible()
    await expect(page.getByTestId('backup-nudge'), 'never both at once').toHaveCount(0)
    await page.getByRole('button', { name: 'Hide this summary' }).click()
    await expect(page.getByTestId('since-last-visit')).toHaveCount(0)
    await expect(page.getByTestId('backup-nudge')).toBeVisible()
  })
}

test('phone backup reminder buttons are short and fit on one row at 390', async ({ page }) => {
  await open(page, 390, 'home')
  await page.getByRole('button', { name: 'Hide this summary' }).click()
  const strip = page.getByTestId('backup-nudge')
  await expect(strip).toBeVisible()
  await expect(strip.getByRole('button', { name: 'Back up now' })).toHaveText('Back up')
  await expect(strip.getByRole('button', { name: /remind me next week/i })).toHaveText('Later')
  const [a, b] = await Promise.all([strip.getByRole('button', { name: 'Back up now' }).boundingBox(), strip.getByRole('button', { name: /remind me next week/i }).boundingBox()])
  expect(Math.abs(a!.y - b!.y), 'both buttons on the same row').toBeLessThan(4)
  expect((await strip.boundingBox())!.height, 'no taller than 150 px (it was 164 px at 320 with two-line buttons)').toBeLessThan(150)
})

for (const w of [1440, 390]) {
  test(`Dashboard @ ${w}: the income ribbons come before Your week and the tip`, async ({ page }) => {
    await open(page, w, 'dashboard')
    await expect(page.getByTestId('money-flow')).toBeVisible()
    const ribbon = (await page.getByTestId('money-flow').boundingBox())!.y
    const week = (await page.getByRole('region', { name: 'Your week' }).boundingBox())!.y
    const tip = (await page.getByTestId('tip-of-day').boundingBox())!.y
    expect(ribbon, 'ribbon above Your week').toBeLessThan(week)
    expect(week, 'Your week above the tip').toBeLessThan(tip)
  })
}
