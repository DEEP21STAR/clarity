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
  await dialog.getByRole('button', { name: /Save income/ }).click()

  await expect(hero).not.toContainText('-$', { timeout: 5000 })
  await expect.poll(() => hero.evaluate((e) => e.classList.contains('hero-pulse')), { timeout: 3000 }).toBe(true)
  expect(await hero.evaluate((e) => getComputedStyle(e).animationName)).toBe('hero-pulse')
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
