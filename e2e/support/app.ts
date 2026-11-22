import type { Page } from '@playwright/test'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const TABS = ['dashboard', 'upcoming', 'transactions', 'budgets', 'debts', 'networth', 'calendar', 'shopping', 'tools'] as const
export const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } } as const
export const SPLASH_TEXT = 'tap anywhere to skip'

/** Opens a tab on a fresh (empty) state with the PIN gate bypassed, the same way every manual check in this project did. */
export async function openApp(page: Page, tab: string = 'upcoming', opts: { skipSplash?: boolean } = {}) {
  await page.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('e2e-seeded')) {
        localStorage.setItem('clarity-dashboard-state-v5', '{}')
        sessionStorage.setItem('e2e-seeded', '1')
      }
      sessionStorage.setItem('clarity-pin-unlocked', '1')
    } catch { /* ignore */ }
  })
  await page.goto(`./?tab=${tab}`)
  if (opts.skipSplash !== false) await dismissSplash(page)
}

/** The boot splash is a full-screen overlay that a tap dismisses. */
export async function dismissSplash(page: Page) {
  const splash = page.getByText(SPLASH_TEXT)
  try {
    await splash.waitFor({ state: 'visible', timeout: 3000 })
    await splash.click({ force: true })
    await splash.waitFor({ state: 'detached', timeout: 8000 })
  } catch { /* no splash this load */ }
  await page.waitForTimeout(400)
}

const OUT = join(process.cwd(), 'test-results', 'measure')
export function writeMeasure(name: string, data: unknown) {
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(data, null, 2))
}

/** Committed baselines: a measurement may get better, never worse. UPDATE_BASELINE=1 rewrites them. */
export function baselineFile(name: string) { return join(process.cwd(), 'e2e', 'baselines', `${name}.json`) }
export function readBaseline<T>(name: string): T | null {
  const f = baselineFile(name)
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as T) : null
}
export function writeBaseline(name: string, data: unknown) {
  const f = baselineFile(name)
  mkdirSync(dirname(f), { recursive: true })
  writeFileSync(f, JSON.stringify(data, null, 2) + '\n')
}
