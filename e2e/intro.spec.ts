import { test, expect } from '@playwright/test'
import { VIEWPORTS } from './support/app'

// The welcome: a cinematic first launch that hands over to the live app, a quick one afterwards, never a wait.
async function prime(page: import('@playwright/test').Page, lastBootAgoMs: number | null) {
  await page.addInitScript((ago) => {
    try {
      localStorage.setItem('clarity-dashboard-state-v5', '{}')
      sessionStorage.setItem('clarity-pin-unlocked', '1')
      if (ago !== null) localStorage.setItem('clarity-last-boot', String(Date.now() - ago))
    } catch { /* ignore */ }
  }, lastBootAgoMs)
}

test.describe('intro, desktop', () => {
  test.use({ viewport: VIEWPORTS.desktop })

  test('first launch: wordmark and greeting, then it hands over to a usable app', async ({ page }) => {
    await prime(page, null)
    await page.goto('./?tab=upcoming')
    await expect(page.getByText('CLARITY', { exact: true })).toBeVisible()
    await expect(page.getByText(/^(Good morning|Good afternoon|Good evening|Welcome back), Deep$/)).toBeVisible()
    await expect(page.getByText('tap anywhere')).toBeVisible()
    await expect(page.getByText('tap anywhere')).toBeHidden({ timeout: 12_000 })
    // the app underneath is live: navigation works
    await page.getByRole('button', { name: /Budgets/ }).click()
    await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible()
  })

  test('any key skips the intro straight away', async ({ page }) => {
    await prime(page, null)
    await page.goto('./?tab=upcoming')
    await expect(page.getByText('tap anywhere')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText('tap anywhere')).toBeHidden({ timeout: 1500 })
  })

  test('a relaunch gets the quick version and is usable within two seconds', async ({ page }) => {
    await prime(page, 60_000)
    const t0 = Date.now()
    await page.goto('./?tab=upcoming')
    await page.getByRole('heading', { name: 'Upcoming Payments' }).waitFor()
    await expect(page.getByText('tap anywhere')).toBeHidden({ timeout: 2000 })
    expect(Date.now() - t0).toBeLessThan(3500)
  })
})

test.describe('intro, reduced motion', () => {
  test.use({ viewport: VIEWPORTS.desktop, reducedMotion: 'reduce' })
  test('a first launch with reduced motion gets the short version, no long animation', async ({ page }) => {
    await prime(page, null)
    await page.goto('./?tab=upcoming')
    await expect(page.getByText('tap anywhere')).toBeHidden({ timeout: 2500 })
  })
})

test.describe('intro, phone', () => {
  test.use({ viewport: VIEWPORTS.phone })
  test('first launch on a phone also hands over and lands on Home', async ({ page }) => {
    await prime(page, null)
    await page.goto('./')
    await expect(page.getByText('tap anywhere')).toBeVisible()
    await expect(page.getByText('tap anywhere')).toBeHidden({ timeout: 12_000 })
    await expect(page.getByRole('button', { name: 'Add an expense or income' })).toBeVisible()
  })
})
