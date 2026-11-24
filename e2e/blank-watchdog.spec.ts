import { test, expect } from '@playwright/test'

// The watchdog in index.html turns a screen that stays empty into a readable diagnostic with Reload / Clear-cache buttons.
test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } })
const fast = () => { (window as unknown as { __clarityWatchdog: object }).__clarityWatchdog = { first: 1200, every: 600, stopAfter: 60000 } }
const unlocked = () => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } }

test('a healthy page never shows the diagnostic', async ({ page }) => {
  await page.addInitScript(fast); await page.addInitScript(unlocked)
  await page.goto('./?tab=budgets')
  await page.waitForTimeout(6000)
  await expect(page.locator('#clarity-diagnostic')).toHaveCount(0)
})

test('the PIN screen and the intro are not mistaken for a blank page', async ({ page }) => {
  await page.addInitScript(fast)
  await page.addInitScript(() => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}') } catch { /* ignore */ } })
  await page.goto('./?tab=budgets&splash=full')
  await page.waitForTimeout(6000)
  await expect(page.locator('#clarity-diagnostic')).toHaveCount(0)
})

test('a page that stays empty shows the diagnostic with the captured error and working buttons', async ({ page }) => {
  await page.addInitScript(fast); await page.addInitScript(unlocked)
  await page.goto('./?tab=budgets')
  await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible()
  await page.evaluate(() => { console.error(new Error('watchdog test error')); (document.getElementById('root') as HTMLElement).style.display = 'none' })
  const diag = page.locator('#clarity-diagnostic')
  await expect(diag).toBeVisible({ timeout: 10000 })
  await expect(diag).toContainText("Clarity didn't finish loading")
  await expect(diag).toContainText('watchdog test error')
  await expect(diag).toContainText('files:')
  await expect(diag.getByRole('button', { name: 'Reload', exact: true })).toBeVisible()
  // the clear-cache button reloads the page into a healthy state
  await diag.getByRole('button', { name: 'Clear app cache and reload' }).click()
  await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible({ timeout: 15000 })
  await expect(page.locator('#clarity-diagnostic')).toHaveCount(0)
})
