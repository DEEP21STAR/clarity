import { test, expect } from '@playwright/test'

// The app is installed as a PWA: after one online visit it must open, and switch between screens, with no network at all.
// (Offline also proves the screens come from the service worker's cache, not from the network.)
test.use({ reducedMotion: 'reduce', viewport: { width: 1100, height: 800 }, serviceWorkers: 'allow' })

test('after one online visit the app opens and switches tabs with no network', async ({ page, context }) => {
  await page.addInitScript(() => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } })
  await page.goto('./?tab=budgets')
  await page.getByRole('heading', { name: 'Budgets' }).waitFor()
  // wait until the service worker has installed AND is controlling this page (clients.claim), then give it a moment to finish precaching
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => new Promise<void>((res) => { if (navigator.serviceWorker.controller) res(); else navigator.serviceWorker.addEventListener('controllerchange', () => res()) })))
  await page.waitForTimeout(3000)

  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible({ timeout: 15000 })
  // lazy screens that were never opened while online must still load (they come from the precache)
  for (const [tab, heading] of [['debts', 'Debts'], ['tools', 'Tools'], ['calendar', 'Bill Calendar']] as const) {
    await page.goto(`./?tab=${tab}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: heading }).first(), `${tab} offline`).toBeVisible({ timeout: 15000 })
  }
  expect(await page.locator('body').innerText()).not.toContain("couldn't load this screen")
  await context.setOffline(false)
})
