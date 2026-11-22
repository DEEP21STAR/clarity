import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { openApp, TABS, VIEWPORTS, writeMeasure, readBaseline, writeBaseline } from './support/app'

// Accessibility measured with axe-core against WCAG 2.0/2.1/2.2 A and AA rules, per tab and screen size.
// Everything is recorded; the test only FAILS when serious+critical violations on a tab rise above the committed baseline.
// Target for a 10: zero serious/critical everywhere.
type Row = { key: string; critical: number; serious: number; moderate: number; minor: number; rules: string[] }
const results: Row[] = []

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`a11y @ ${vpName}`, () => {
    test.use({ viewport: vp })
    for (const tab of TABS) {
      test(`${tab}`, async ({ page }) => {
        await openApp(page, tab)
        await page.waitForTimeout(800)
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
        const by = (i: string) => r.violations.filter((v) => v.impact === i).length
        results.push({ key: `${vpName}/${tab}`, critical: by('critical'), serious: by('serious'), moderate: by('moderate'), minor: by('minor'), rules: r.violations.map((v) => `${v.id}(${v.nodes.length})`) })
      })
    }
  })
}

test.afterAll(() => {
  results.sort((a, b) => a.key.localeCompare(b.key))
  writeMeasure('a11y', results)
  if (process.env.UPDATE_BASELINE === '1') { writeBaseline('a11y', results); return }
  const base = readBaseline<Row[]>('a11y')
  if (!base) return
  for (const row of results) {
    const was = base.find((b) => b.key === row.key)
    if (was) expect(row.critical + row.serious, `${row.key}: serious+critical rose from ${was.critical + was.serious}`).toBeLessThanOrEqual(was.critical + was.serious)
  }
})
