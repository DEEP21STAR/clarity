// Prints the measured scorecard from test-results/measure/*.json against the "10" targets. Run after `npm run e2e` (or use `npm run measure`).
import { readFileSync, existsSync } from 'node:fs'
const rd = (n) => { const f = `test-results/measure/${n}.json`; return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null }
const perf = rd('perf'), a11y = rd('a11y'), relaunch = rd('perf-relaunch')
const rows = []
const row = (area, metric, value, target, ok) => rows.push({ area, metric, value, target, status: value === 'n/a' ? 'not measured' : ok ? 'PASS' : 'below 10' })
if (perf) {
  if (relaunch) row('Effortless', 'Time to usable, everyday relaunch', `${relaunch.timeToUsableMs} ms`, '<= 1000 ms', relaunch.timeToUsableMs <= 1000)
  row('Effortless', 'Time to usable, first launch (full splash)', `${perf.timeToUsableMs} ms`, '<= 3000 ms (brand moment)', perf.timeToUsableMs <= 3000)
  row('Performance', 'Largest contentful paint', `${perf.lcpMs} ms`, '<= 2500 ms', perf.lcpMs <= 2500)
  row('Performance', 'JavaScript downloaded at launch, gzipped', perf.firstLoadJsGzipBytes != null ? `${Math.round(perf.firstLoadJsGzipBytes / 1024)} KB` : 'n/a', '<= 250 KB', perf.firstLoadJsGzipBytes != null && perf.firstLoadJsGzipBytes <= 250 * 1024)
  row('Performance', 'JavaScript, all chunks, gzipped', `${Math.round(perf.jsGzipBytes / 1024)} KB`, 'informational', true)
  row('Performance', 'Long-task blocking', `${perf.longTaskMs} ms`, '<= 300 ms', perf.longTaskMs <= 300)
} else row('Performance', 'startup + bundle', 'n/a', '-', false)
if (a11y) {
  const sc = a11y.reduce((s, r) => s + r.critical + r.serious, 0), all = a11y.reduce((s, r) => s + r.critical + r.serious + r.moderate + r.minor, 0)
  row('Accessibility', 'Serious + critical axe violations (all tabs, both sizes)', String(sc), '0', sc === 0)
  row('Accessibility', 'All axe violations', String(all), '0', all === 0)
  const worst = [...a11y].sort((a, b) => b.critical + b.serious - (a.critical + a.serious))[0]
  if (worst && worst.critical + worst.serious > 0) console.log(`Worst page: ${worst.key} -> ${worst.rules.join(', ')}\n`)
} else row('Accessibility', 'axe', 'n/a', '-', false)
console.log('| Area | Metric | Measured | Target for 10 | Status |\n|---|---|---|---|---|')
for (const r of rows) console.log(`| ${r.area} | ${r.metric} | ${r.value} | ${r.target} | ${r.status} |`)
console.log('\nSmoke and CSV-flow results are the Playwright pass/fail list above this table.')
