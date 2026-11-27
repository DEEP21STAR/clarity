// Generates src/lightTheme.generated.css: light-mode overrides for every colour utility the app uses that assumes a dark background.
// Run: node scripts/gen-light-theme.mjs   (re-run after adding new text-white/*, bg-black/*, text-<colour>-300 style classes)
//   text-white[/n]        -> dark ink
//   bg-white/n            -> faint ink tint (a subtle panel on light)
//   bg-black/n            -> white panel (an overlay that darkened dark UI now lightens it)
//   border-/ring-/divide-white/n -> faint ink line
//   text-<colour>-100..400 -> the same colour at 700/600 so it keeps contrast on white
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p, out); else if (/\.(tsx?|css)$/.test(f) && !f.includes('.generated.')) out.push(p) }
  return out
}
const src = walk(join(root, 'src')).map((f) => readFileSync(f, 'utf8')).join('\n')
const theme = readFileSync(join(root, 'node_modules/tailwindcss/theme.css'), 'utf8')
const palette = Object.fromEntries([...theme.matchAll(/--color-([a-z]+-\d+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))

const INK = '26 16 51' // deep violet-black
const re = /(?<![\w-])((?:(?:hover|focus|active|group-hover|focus-visible|disabled|placeholder):)*)(text|bg|border|ring|divide|from|to|via)-(white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(\d{2,3}))(?:\/(\d{1,3}))?(?![\w-])/g
const seen = new Map()
for (const m of src.matchAll(re)) seen.set(m[0], m)

const esc = (c) => c.replace(/([:/.\[\]%#])/g, '\\$1')
const sel = (c, variants) => {
  // translate the variant prefix into a selector suffix/prefix
  let s = '.' + esc(c)
  for (const v of variants.split(':').filter(Boolean)) {
    if (v === 'hover') s += ':hover'
    else if (v === 'focus') s += ':focus'
    else if (v === 'active') s += ':active'
    else if (v === 'focus-visible') s += ':focus-visible'
    else if (v === 'disabled') s += ':disabled'
    else if (v === 'placeholder') s += '::placeholder'
    else if (v === 'group-hover') s = '.group:hover ' + s
  }
  return `html[data-theme='light'] ${s}`
}
const alpha = (n, k = 1) => (n === undefined ? '' : ` / ${Math.min(100, Math.round(Number(n) * k))}%`)
const rules = []
for (const [cls, m] of seen) {
  const [, variants, kind, color, shade, a] = m
  let decl = null
  if (color === 'white') {
    if (kind === 'text') decl = `color: rgb(${INK}${a === undefined ? '' : alpha(Math.min(100, Number(a) + 14))})`
    if (kind === 'bg') decl = `background-color: rgb(${INK}${alpha(a ?? 100, 0.55)})`
    if (kind === 'border') decl = `border-color: rgb(${INK}${alpha(a ?? 100, 1.1)})`
    if (kind === 'ring') decl = `--tw-ring-color: rgb(${INK}${alpha(a ?? 100, 1.1)})`
    if (kind === 'divide') decl = `border-color: rgb(${INK}${alpha(a ?? 100, 1.1)})`
  } else if (color === 'black') {
    if (kind === 'bg') decl = `background-color: rgb(255 255 255${alpha(Math.min(100, Number(a ?? 100) + 25))})`
    if (kind === 'border') decl = `border-color: rgb(${INK}${alpha(a ?? 100, 0.6)})`
  } else if (kind === 'text' && shade && Number(shade) <= 400) {
    const name = color.replace(/-\d+$/, '')
    const target = palette[`${name}-${Number(shade) <= 300 ? 700 : 600}`]
    if (target) decl = `color: ${target}`
  }
  if (decl) rules.push(`${sel(cls, variants)} { ${decl}; }`)
}

// white-ish `color:` declarations written directly in index.css rules (nav tabs, headings, labels...)
{
  const css = readFileSync(join(root, 'src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const white = /^(?:#fff(?:fff)?|white|rgba?\(\s*2[45]\d\s*[, ]\s*2[45]\d\s*[, ]\s*2[45]\d\s*(?:[,/]\s*([\d.]+%?))?\s*\))$/i
  for (const m of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim()
    if (!selector || selector.includes("data-theme")) continue
    const dm = /(?:^|;)\s*color:\s*([^;]+?)\s*(?:;|$)/.exec(m[2])
    if (!dm) continue
    const wm = white.exec(dm[1].trim())
    if (!wm) continue
    let a = wm[1] === undefined ? 1 : wm[1].endsWith('%') ? parseFloat(wm[1]) / 100 : parseFloat(wm[1])
    a = Math.min(1, a + 0.14)
    const sels = selector.split(',').map((x) => `html[data-theme='light'] ${x.trim()}`).join(', ')
    rules.push(`${sels} { color: rgb(${INK} / ${Math.round(a * 100)}%); }`)
  }
}
// arbitrary dark hex backgrounds: bg-[#05060a] or bg-[#05060a]/80 (header, drawer, popovers, command palette)
for (const m of src.matchAll(/(?<![\w-])bg-\[#([0-9a-fA-F]{6})\](?:\/(\d{1,3}))?(?![\w-])/g)) {
  const n = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16))
  if ((0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2]) / 255 < 0.25) {
    const cls = `bg-[#${m[1]}]` + (m[2] ? `/${m[2]}` : '')
    rules.push(`html[data-theme='light'] .${esc(cls)} { background-color: rgb(255 255 255${m[2] ? ` / ${Math.min(100, Number(m[2]) + 12)}%` : ''}); }`)
  }
}
rules.splice(0, rules.length, ...[...new Set(rules)].sort())

const base = `/* GENERATED by scripts/gen-light-theme.mjs. Do not edit by hand. Active only when <html data-theme="light"> (Settings > Appearance). */
html[data-theme='light'] {
  color-scheme: light;
  --bg-void: #f5f2fb;
  --bg-panel: #ffffff;
  --text: rgb(${INK});
  --ux-bg-mesh:
    radial-gradient(1100px 700px at 15% -5%, color-mix(in oklab, var(--ux-accent-a) 16%, transparent), transparent),
    radial-gradient(1000px 700px at 90% 15%, color-mix(in oklab, var(--ux-accent-b) 12%, transparent), transparent),
    radial-gradient(1200px 600px at 50% 110%, color-mix(in oklab, var(--ux-accent-a) 8%, transparent), transparent);
  --ux-glass-bg: linear-gradient(155deg, rgb(255 255 255 / .96), rgb(255 255 255 / .82) 55%, rgb(244 240 252 / .9));
  --ux-glass-edge: inset 0 1px 0 rgb(255 255 255 / .9), inset 0 0 0 1px rgb(${INK} / .10), 0 8px 30px -14px rgb(${INK} / .25);
}
html[data-theme='light'] body { color: rgb(${INK}); background: var(--ux-bg-mesh), var(--bg-void); }
html[data-theme='light'] body::after { opacity: .03; }
html[data-theme='light'] canvas.ambient, html[data-theme='light'] .ambient-canvas { opacity: .25; }
html[data-theme='light'] .glass-card, html[data-theme='light'] .ux-glass, html[data-theme='light'] .glass { box-shadow: var(--ux-glass-edge); }
html[data-theme='light'] input, html[data-theme='light'] select, html[data-theme='light'] textarea { color: rgb(${INK}); background-color: rgb(255 255 255 / .85); border-color: rgb(${INK} / .22); color-scheme: light; }
html[data-theme='light'] ::placeholder { color: rgb(${INK} / .5); }
`

const extraCss = `
/* card panels and other surfaces that carry their own dark gradient instead of the shared token */
html[data-theme='light'] .glass-panel, html[data-theme='light'] .ticker-wrap { background: var(--ux-glass-bg); }
html[data-theme='light'] header.sticky { border-color: rgb(${INK} / .12); }
html[data-theme='light'] [style*='rgba(11, 13, 20'], html[data-theme='light'] [style*='rgb(11, 13, 20'] { background-image: linear-gradient(160deg, rgb(255 255 255 / .96), rgb(250 244 252 / .92)) !important; }
html[data-theme='light'] .gradient-heading, html[data-theme='light'] .ux-hero-number { filter: brightness(.66) saturate(1.3); }
html[data-theme='light'] .wfd-footer { box-shadow: 0 -1px 0 rgb(${INK} / .12); }
`
writeFileSync(join(root, 'src/lightTheme.generated.css'), base + extraCss + rules.join('\n') + '\n')
console.log(`light theme: ${rules.length} override rules from ${seen.size} colour utilities`)
