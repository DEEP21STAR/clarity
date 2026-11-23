import { test, expect } from '@playwright/test'
import { VIEWPORTS } from './support/app'

// The insights marquee: stoppable without a mouse (WCAG 2.2.2) and read once, not twice, by a screen reader.
test.use({ viewport: VIEWPORTS.desktop, reducedMotion: 'no-preference' })

test('the marquee has a working pause button and its loop copy is hidden from screen readers', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1'); localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000)) } catch { /* ignore */ } })
  await page.goto('./?tab=dashboard')
  const track = page.locator('.ticker-track')
  await expect(track).toBeVisible()
  const state = () => track.evaluate((el) => getComputedStyle(el).animationPlayState)

  // the second half is aria-hidden, the first half is not
  const spans = await track.evaluate((el) => [...el.children].map((c) => c.getAttribute('aria-hidden')))
  expect(spans.length).toBeGreaterThanOrEqual(2)
  expect(spans.length % 2).toBe(0)
  const half = spans.length / 2
  expect(spans.slice(0, half).every((a) => a === null), 'first copy stays readable').toBe(true)
  expect(spans.slice(half).every((a) => a === 'true'), 'second copy is hidden').toBe(true)

  // pause / resume
  expect(await state()).toBe('running')
  const pause = page.getByRole('button', { name: 'Pause scrolling insights' })
  await pause.click()
  expect(await state()).toBe('paused')
  const resume = page.getByRole('button', { name: 'Resume scrolling insights' })
  await expect(resume).toHaveAttribute('aria-pressed', 'true')
  // it really stopped: the position does not change while paused
  await page.mouse.move(5, 5)
  const x1 = await track.evaluate((el) => el.getBoundingClientRect().left)
  await page.waitForTimeout(700)
  const x2 = await track.evaluate((el) => el.getBoundingClientRect().left)
  expect(x2).toBe(x1)
  await resume.click()
  await page.mouse.move(5, 5) // the marquee also pauses while hovered; step away so only the button state is measured
  expect(await state()).toBe('running')
  await page.locator('.ticker-wrap').screenshot({ path: 'test-results/ticker.png' })
})
