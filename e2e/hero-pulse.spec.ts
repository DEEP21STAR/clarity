import { test, expect } from '@playwright/test'
import { openApp } from './support/app'

// Home's free-to-spend figure gives one soft glow when it stops being overspent (or starts being). Default demo data is overspent on Home.
test('the figure glows once when adding income takes it out of overspent, and not before', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openApp(page, 'home')
  const hero = page.getByTestId('live-funds')
  await expect(hero).toContainText('-$')
  await page.waitForTimeout(1500)
  expect(await hero.evaluate((e) => e.classList.contains('hero-pulse')), 'no glow on first load').toBe(false)

  await page.getByRole('button', { name: 'Add an expense or income' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add entry' })
  await dialog.getByRole('button', { name: /^Income$/ }).click()
  await dialog.getByLabel('Amount ($)').fill('5000')
  // sample the glow itself (not just the class) for ~2.5 s from the moment of saving: the figure is gradient text with a transparent
  // colour, so a glow that borrows the text colour is invisible (found by Predator on 091da23); the filter shadow must really be drawn
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="live-funds"]') as HTMLElement
    const w = window as unknown as { __glow: string[] }
    w.__glow = []
    const t0 = performance.now()
    const tick = () => { w.__glow.push(getComputedStyle(el).filter); if (performance.now() - t0 < 2500) requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  })
  await dialog.getByRole('button', { name: /Save income/ }).click()

  await expect(hero).not.toContainText('-$', { timeout: 5000 })
  await expect.poll(() => hero.evaluate((e) => e.classList.contains('hero-pulse')), { timeout: 3000 }).toBe(true)
  expect(await hero.evaluate((e) => getComputedStyle(e).animationName)).toBe('hero-pulse')
  await page.waitForTimeout(2600)
  const samples = await page.evaluate(() => (window as unknown as { __glow: string[] }).__glow)
  const shadows = samples.map((f) => {
    const m = f.match(/drop-shadow\((.*) 0px 0px ([\d.]+)px\)/) // Chrome writes the colour as oklab(... / a) or rgba(r, g, b, a)
    if (!m) return null
    const slash = m[1].match(/\/\s*([\d.]+)\)/)
    const rgba = m[1].match(/rgba\([^)]*,\s*([\d.]+)\)/)
    return { blur: parseFloat(m[2]), alpha: slash ? parseFloat(slash[1]) : rgba ? parseFloat(rgba[1]) : 1 }
  }).filter((x): x is { blur: number; alpha: number } => x !== null)
  const peak = shadows.reduce((a, b) => (b.blur * b.alpha > a.blur * a.alpha ? b : a), { blur: 0, alpha: 0 })
  expect(shadows.length, `filter samples: ${samples.slice(0, 3).join(' | ')}`).toBeGreaterThan(10)
  expect(peak.blur, 'the glow grows well past the resting 18px shadow').toBeGreaterThan(26)
  expect(peak.alpha, 'and is drawn in a visible colour, not transparent').toBeGreaterThan(0.6)
  // and it settles
  await expect.poll(() => hero.evaluate((e) => e.classList.contains('hero-pulse')), { timeout: 4000 }).toBe(false)
})

test('with reduced motion there is no animation at all', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, serviceWorkers: 'block', baseURL: 'http://127.0.0.1:4173/clarity/' })
  const page = await ctx.newPage()
  await openApp(page, 'home')
  await page.getByRole('button', { name: 'Add an expense or income' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add entry' })
  await dialog.getByRole('button', { name: /^Income$/ }).click()
  await dialog.getByLabel('Amount ($)').fill('5000')
  await dialog.getByRole('button', { name: /Save income/ }).click()
  const hero = page.getByTestId('live-funds')
  await expect(hero).not.toContainText('-$', { timeout: 5000 })
  await page.waitForTimeout(300)
  expect(await hero.evaluate((e) => getComputedStyle(e).animationName)).toBe('none')
  await ctx.close()
})
