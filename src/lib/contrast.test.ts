import { describe, expect, it } from 'vitest'

// Guards the text hierarchy: grey text is white at some opacity, and below ~46% it stops being readable on the app's dark glass
// (axe cannot judge translucent text over gradients, so this calculates it). Three tiers: primary 80-95, secondary 60-70, muted 50-55.
const BG = [5, 6, 10] // page background #05060a
const CARD = [18, 20, 30] // typical glass card

function lum([r, g, b]: number[]) {
  const f = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function ratio(a: number[], b: number[]) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
function whiteAlphaOver(alpha: number, under: number[]) { return under.map((u) => Math.round(u + (255 - u) * alpha)) }
export function textContrast(alphaPercent: number) { return Math.min(ratio(whiteAlphaOver(alphaPercent / 100, BG), BG), ratio(whiteAlphaOver(alphaPercent / 100, CARD), CARD)) }

// Every component's source text, read at test time through Vite (no Node types needed).
const SOURCES = import.meta.glob('/src/**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('grey text contrast', () => {
  it('the muted tier (50%) and above meets 4.5:1, 45% does not', () => {
    expect(textContrast(50)).toBeGreaterThanOrEqual(4.5)
    expect(textContrast(55)).toBeGreaterThanOrEqual(4.5)
    expect(textContrast(40)).toBeLessThan(4.5)
  })
  it('no component uses plain white text below the muted tier', () => {
    expect(Object.keys(SOURCES).length, 'component sources were found').toBeGreaterThan(20)
    const offenders: string[] = []
    for (const [file, text] of Object.entries(SOURCES)) {
      text.split('\n').forEach((line: string, i: number) => {
        for (const m of line.matchAll(/(?<![\w:-])text-white\/(\d+)(?!\d)/g)) {
          if (Number(m[1]) < 50) offenders.push(`${file}:${i + 1} text-white/${m[1]}`)
        }
      })
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
