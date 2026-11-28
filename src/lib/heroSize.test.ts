import { describe, expect, it } from 'vitest'
import { heroAmountSize, heroAmountText } from './heroSize'

describe('heroAmountText', () => {
  it('matches how the amount is drawn', () => {
    expect(heroAmountText(-674.94)).toBe('-$674.94')
    expect(heroAmountText(1534.21)).toBe('$1,534.21')
    expect(heroAmountText(-12674.94)).toBe('-$12,674.94')
    expect(heroAmountText(0)).toBe('$0.00')
  })
})

describe('heroAmountSize', () => {
  it('Upcoming hero: full size for short amounts, stepping down for longer ones', () => {
    expect(heroAmountSize(-674.94, { desktopFull: true })).toBe('text-4xl min-[360px]:text-5xl min-[440px]:text-6xl md:text-8xl')
    expect(heroAmountSize(-99.5, { desktopFull: true })).toBe('text-5xl min-[400px]:text-6xl md:text-8xl')
    expect(heroAmountSize(-12674.94, { desktopFull: true })).toBe('text-2xl min-[360px]:text-3xl min-[440px]:text-5xl md:text-7xl')
    expect(heroAmountSize(-1234567.89, { desktopFull: true })).toBe('text-xl min-[360px]:text-2xl min-[440px]:text-4xl md:text-6xl')
  })
  it('phone Home hero: narrower, so it steps down earlier', () => {
    expect(heroAmountSize(-674.94)).toBe('text-4xl') // 8 chars (wrapped at text-5xl in real Brave at 320px)
    expect(heroAmountSize(-74.94)).toBe('text-5xl') // 7 chars
    expect(heroAmountSize(12.5)).toBe('text-5xl') // "$12.50"
    expect(heroAmountSize(1534.21)).toBe('text-4xl') // "$1,534.21" 9 chars
    expect(heroAmountSize(-1534.21)).toBe('text-3xl') // 10
    expect(heroAmountSize(-12674.94)).toBe('text-3xl') // 11
    expect(heroAmountSize(-123674.94)).toBe('text-2xl') // 12
  })
})
