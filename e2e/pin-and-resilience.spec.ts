import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { VIEWPORTS } from './support/app'

// The PIN is read from the app's own source so it is never written into a test or a log. Local preview only.
const PIN = readFileSync('src/lib/constants.ts', 'utf8').match(/CLARITY_PIN\s*=\s*['"](\d{4})['"]/)?.[1] ?? ''
test.use({ reducedMotion: 'reduce', viewport: VIEWPORTS.desktop })

const quietBoot = () => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } }

test.describe('PIN screen keyboard', () => {
  test('the PIN is readable from source for this test', () => { expect(PIN).toMatch(/^\d{4}$/) })

  test('the number row, the numpad, and Backspace all work', async ({ page }) => {
    await page.addInitScript(quietBoot)
    await page.goto('./?tab=budgets')
    await expect(page.getByText('Enter your PIN')).toBeVisible()
    const dots = () => page.locator('.pin-dots > div')
    const filled = () => dots().evaluateAll((els) => els.filter((e) => (e as HTMLElement).style.background !== '').length)
    // numpad keys (NumLock on and off both report code NumpadN) fill the dots
    await page.keyboard.press(`Numpad${PIN[0]}`)
    await page.keyboard.press(`Digit${PIN[1]}`)
    expect(await filled()).toBe(2)
    await page.keyboard.press('Backspace')
    expect(await filled()).toBe(1)
    await page.keyboard.press(`Digit${PIN[1]}`)
    await page.keyboard.press(`Numpad${PIN[2]}`)
    await page.keyboard.press(`Digit${PIN[3]}`)
    await expect(page.getByText('Enter your PIN')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible()
  })

  test('a wrong PIN on the keyboard is rejected and clears', async ({ page }) => {
    await page.addInitScript(quietBoot)
    await page.goto('./?tab=budgets')
    const wrong = PIN.split('').map((d) => String((Number(d) + 1) % 10)).join('')
    for (const d of wrong) await page.keyboard.press(`Digit${d}`)
    await page.waitForTimeout(800)
    await expect(page.getByText('Enter your PIN')).toBeVisible()
  })
})

test.describe('a tab file that fails to load must never leave a blank screen', () => {
  const unlocked = () => { try { sessionStorage.setItem('clarity-pin-unlocked', '1') } catch { /* ignore */ } }

  test('a one-off failure recovers by itself (reload once)', async ({ page }) => {
    await page.addInitScript(quietBoot); await page.addInitScript(unlocked)
    let failed = 0
    await page.route(/\/assets\/Budgets-[^/]*\.js/, (route) => { if (failed++ === 0) return route.abort(); return route.continue() })
    await page.goto('./?tab=budgets')
    await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible({ timeout: 15000 })
    expect(failed).toBeGreaterThanOrEqual(1)
  })

  test('a lasting failure shows a message and a Reload button, not a blank page', async ({ page }) => {
    await page.addInitScript(quietBoot); await page.addInitScript(unlocked)
    await page.route(/\/assets\/Budgets-[^/]*\.js/, (route) => route.abort())
    await page.goto('./?tab=budgets')
    await expect(page.getByRole('heading', { name: /couldn.t load this screen/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible()
    expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(50)
  })

  test('one broken screen leaves the navigation usable, and switching tab clears the message', async ({ page }) => {
    await page.addInitScript(quietBoot); await page.addInitScript(unlocked)
    await page.route(/\/assets\/Budgets-[^/]*\.js/, (route) => route.abort())
    await page.goto('./?tab=budgets')
    await expect(page.getByRole('heading', { name: /couldn.t load this screen/i })).toBeVisible({ timeout: 15000 })
    // the header navigation is still there (a full-screen error panel would have replaced it)
    const dashboardTab = page.getByRole('button', { name: /^Dashboard$/ }).first()
    await expect(dashboardTab).toBeVisible()
    await dashboardTab.click()
    await expect(page.getByRole('heading', { name: 'Dashboard' }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: /couldn.t load this screen/i })).toHaveCount(0)
  })
})
