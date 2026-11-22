import { test, expect } from '@playwright/test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { writeMeasure, readBaseline, writeBaseline } from './support/app'

/** Installed before the page loads: records, in page time since navigation start, when the boot splash first appears and when it disappears. Avoids racing a 0.7 s splash from outside. */
function installSplashTracker() {
  const w = window as unknown as { __splash: { start: number | null; end: number | null } }
  w.__splash = { start: null, end: null }
  const check = () => {
    const present = !!document.body && (document.body.textContent ?? '').includes('tap anywhere')
    if (present && w.__splash.start === null) w.__splash.start = performance.now()
    if (!present && w.__splash.start !== null && w.__splash.end === null) w.__splash.end = performance.now()
  }
  new MutationObserver(check).observe(document, { childList: true, subtree: true, characterData: true })
  check()
}

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
  await page.addInitScript(installSplashTracker)
  await page.addInitScript(() => {
    try { localStorage.setItem('clarity-dashboard-state-v5', '{}'); sessionStorage.setItem('clarity-pin-unlocked', '1') } catch { /* ignore */ }
    const w = window as unknown as { __m: { lcp: number; longMs: number; fcp: number } }
    w.__m = { lcp: 0, longMs: 0, fcp: 0 }
    new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__m.lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__m.longMs += e.duration }).observe({ type: 'longtask', buffered: true })
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') w.__m.fcp = e.startTime }).observe({ type: 'paint', buffered: true })
  })
  await page.goto('./?tab=upcoming')
  // time-to-usable = page time (since navigation start) at which the boot splash disappeared on its own, nobody tapping
  await page.waitForFunction(() => { const sp = (window as unknown as { __splash: { start: number | null; end: number | null } }).__splash; return sp.end !== null || (sp.start === null && performance.now() > 4000) }, undefined, { timeout: 30000 })
  const splashMs = await page.evaluate(() => Math.round((window as unknown as { __splash: { end: number | null } }).__splash.end ?? 0))
  await page.waitForTimeout(1500)
  const m = await page.evaluate(() => (window as unknown as { __m: Record<string, number> }).__m)
  const nodes = await page.evaluate(() => document.getElementsByTagName('*').length)
  const out = { timeToUsableMs: splashMs, fcpMs: Math.round(m.fcp), lcpMs: Math.round(m.lcp), longTaskMs: Math.round(m.longMs), domNodes: nodes, ...bundleBytes() }
  writeMeasure('perf', out)
  if (process.env.UPDATE_BASELINE === '1') { writeBaseline('perf', out); return }
  const base = readBaseline<typeof out>('perf')
  if (base) {
    // The first-launch time includes the animated splash and swung 5.6-7.3 s between identical builds, so it gets a wider band.
    const tolerance = { timeToUsableMs: 1.6, lcpMs: 1.25, jsGzipBytes: 1.25, domNodes: 1.25 } as const
    for (const k of ['timeToUsableMs', 'lcpMs', 'jsGzipBytes', 'domNodes'] as const) {
      expect(out[k], `${k} got >${Math.round((tolerance[k] - 1) * 100)}% worse (baseline ${base[k]})`).toBeLessThanOrEqual(Math.max(base[k] * tolerance[k], base[k] + 200))
    }
  }
})

// Relaunch: the same browser opened again a minute later should get the quick splash, not the full one.
test('relaunch is quick', async ({ page }) => {
  await page.addInitScript(installSplashTracker)
  await page.addInitScript(() => {
    try {
      localStorage.setItem('clarity-dashboard-state-v5', '{}')
      localStorage.setItem('clarity-last-boot', String(Date.now() - 60_000))
      sessionStorage.setItem('clarity-pin-unlocked', '1')
    } catch { /* ignore */ }
  })
  await page.goto('./?tab=upcoming')
  await page.waitForFunction(() => { const sp = (window as unknown as { __splash: { start: number | null; end: number | null } }).__splash; return sp.end !== null || (sp.start === null && performance.now() > 4000) }, undefined, { timeout: 30000 })
  const ms = await page.evaluate(() => Math.round((window as unknown as { __splash: { end: number | null } }).__splash.end ?? 0))
  writeMeasure('perf-relaunch', { timeToUsableMs: ms })
  expect(ms, 'relaunch time to usable (ms)').toBeLessThanOrEqual(3500)
})
