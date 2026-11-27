import { test, expect } from '@playwright/test'

// Appearance (Tools): Dark is the default and sets nothing on <html>; Light sets data-theme="light"; the choice is saved; bad saved values fall back to dark.
const seed = (extra: object) => ({ grossAnnualIncome: 90000, country: 'NZ', ...extra })
async function open(page: import('@playwright/test').Page, tab: string, state: object) {
  await page.addInitScript((s) => { try { sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60000)); localStorage.setItem('clarity-whatsnew-seen', '2026-11-25'); if (!sessionStorage.getItem('seeded')) { localStorage.setItem('clarity-dashboard-state-v5', JSON.stringify(s)); sessionStorage.setItem('seeded', '1') } } catch { /* ignore */ } }, state)
  await page.goto(`./?tab=${tab}`)
}
const theme = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.dataset.theme ?? 'dark')

test('dark is the default, Light switches the whole app and is remembered, Dark switches back', async ({ page }) => {
  await open(page, 'tools', seed({}))
  expect(await theme(page)).toBe('dark')
  const group = page.getByRole('radiogroup', { name: 'Appearance' })
  await expect(group.getByRole('radio', { name: /Dark/ })).toHaveAttribute('aria-checked', 'true')
  await group.getByRole('radio', { name: /Light/ }).click()
  expect(await theme(page)).toBe('light')
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  const lum = (c: string) => { const n = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number); return (0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2]) / 255 }
  expect(lum(bg), `body background ${bg} is light`).toBeGreaterThan(0.85)
  await page.reload()
  await page.waitForTimeout(600)
  expect(await theme(page), 'remembered after reload').toBe('light')
  await page.getByRole('radiogroup', { name: 'Appearance' }).getByRole('radio', { name: /Dark/ }).click()
  expect(await theme(page)).toBe('dark')
})

test('an unreadable saved appearance falls back to dark', async ({ page }) => {
  await open(page, 'dashboard', seed({ colorMode: 'blue' }))
  await page.waitForTimeout(800)
  expect(await theme(page)).toBe('dark')
})

test('light mode: page text is dark on a light surface across the main screens (no white-on-white)', async ({ page }) => {
  await open(page, 'dashboard', seed({ colorMode: 'light' }))
  for (const tab of ['dashboard', 'upcoming', 'budgets', 'tools']) {
    await page.goto(`./?tab=${tab}`)
    await page.waitForTimeout(900)
    const bad = await page.evaluate(() => {
      const L = (c: string) => { const n = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number); return (0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2]) / 255 }
      const out: string[] = []
      for (const e of document.querySelectorAll<HTMLElement>('h1,h2,h3,p,label,button,a,span')) {
        if (!e.childNodes.length || ![...e.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim())) continue
        const r = e.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue
        const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.color === 'rgba(0, 0, 0, 0)' || cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || cs.backgroundClip === 'text' || (cs as unknown as { webkitBackgroundClip?: string }).webkitBackgroundClip === 'text') continue
        if (L(cs.color) > 0.8) out.push(`${(e.textContent || '').trim().slice(0, 24)} ${cs.color}`)
      }
      return out.slice(0, 6)
    })
    expect(bad, `near-white text on ${tab} in light mode`).toEqual([])
  }
})
