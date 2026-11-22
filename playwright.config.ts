import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

// Measuring tools for Clarity: smoke + CSV flows + accessibility (axe) + performance, against the PRODUCTION build.
//   npm run e2e        run everything
//   npm run measure    run everything, then print the scorecard (scripts/scorecard.mjs)
// Uses the system Chromium when present (CHROME_REAL overrides) so no browser download is needed.
const PORT = 4173
const chrome = process.env.CHROME_REAL ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000, toHaveScreenshot: { maxDiffPixelRatio: 0.002 } },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/clarity/`,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    // PW_CHANNEL=chrome (or msedge) uses an installed browser, e.g. on Windows; otherwise the system Chromium path, otherwise Playwright's own.
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL as 'chrome' } : { launchOptions: chrome ? { executablePath: chrome } : {} }),
  },
  webServer: {
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/clarity/`,
    reuseExistingServer: false, // never reuse: a stale preview server once served an old build and gave false numbers
    timeout: 240_000,
  },
})
