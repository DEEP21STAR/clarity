import { test, expect } from '@playwright/test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { SPLASH_TEXT, writeMeasure, readBaseline, writeBaseline } from './support/app'

// Performance measured on the production build. Recorded always; fails only when a number gets >25% worse than the committed baseline.
// Targets for a 10: time-to-usable <= 1000 ms, gzip JS <= 300 KB, LCP <= 2500 ms (unthrottled desktop, so a mid-range phone will be slower).
function bundleBytes() {
  const dir = join(process.cwd(), 'dist', 'assets')
  let js = 0, css = 0, jsGzip = 0
  for (const f of readdirSync(dir)) {
    const p = join(dir, f), size = statSync(p).size
    if (f.endsWith('.js')) { js += size; jsGzip += gzipSync(readFileSync(p)).length }
    else if (f.endsWith('.css')) css += size
  }
  return { jsBytes: js, jsGzipBytes: jsGzip, cssBytes: css }
}

test('startup and bundle metrics', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1') } catch { /* ignore */ }
    const w = window as unknown as { __m: { lcp: number; longMs: number; fcp: number } }
    w.__m = { lcp: 0, longMs: 0, fcp: 0 }
    new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__m.lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__m.longMs += e.duration }).observe({ type: 'longtask', buffered: true })
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') w.__m.fcp = e.startTime }).observe({ type: 'paint', buffered: true })
  })
  const t0 = Date.now()
  await page.goto('./?tab=upcoming')
  // time-to-usable = until the boot splash is gone WITHOUT the user tapping it
  let splashMs = 0
  try {
    await page.getByText(SPLASH_TEXT).waitFor({ state: 'visible', timeout: 3000 })
    await page.getByText(SPLASH_TEXT).waitFor({ state: 'detached', timeout: 20000 })
    splashMs = Date.now() - t0
  } catch { splashMs = Date.now() - t0 }
  await page.waitForTimeout(1500)
  const m = await page.evaluate(() => (window as unknown as { __m: Record<string, number> }).__m)
  const nodes = await page.evaluate(() => document.getElementsByTagName('*').length)
  const out = { timeToUsableMs: splashMs, fcpMs: Math.round(m.fcp), lcpMs: Math.round(m.lcp), longTaskMs: Math.round(m.longMs), domNodes: nodes, ...bundleBytes() }
  writeMeasure('perf', out)
  if (process.env.UPDATE_BASELINE === '1') { writeBaseline('perf', out); return }
  const base = readBaseline<typeof out>('perf')
  if (base) {
    for (const k of ['timeToUsableMs', 'lcpMs', 'jsGzipBytes', 'domNodes'] as const) {
      expect(out[k], `${k} got >25% worse (baseline ${base[k]})`).toBeLessThanOrEqual(Math.max(base[k] * 1.25, base[k] + 200))
    }
  }
})

// Relaunch: the same browser opened again a minute later should get the quick splash, not the full one.
test('relaunch is quick', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('clarity-dashboard-state-v5', '{}')
      localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000))
      sessionStorage.setItem('clarity-pin-unlocked', '1')
    } catch { /* ignore */ }
  })
  const t0 = Date.now()
  await page.goto('./?tab=upcoming')
  let ms = 0
  try {
    await page.getByText(SPLASH_TEXT).waitFor({ state: 'visible', timeout: 3000 })
    await page.getByText(SPLASH_TEXT).waitFor({ state: 'detached', timeout: 20000 })
    ms = Date.now() - t0
  } catch { ms = Date.now() - t0 }
  writeMeasure('perf-relaunch', { timeToUsableMs: ms })
  expect(ms, 'relaunch time to usable (ms)').toBeLessThanOrEqual(3500)
})
