import { describe, expect, it } from 'vitest'
import { chooseBootMode, FULL_SPLASH_GAP_MS, readLastBoot, writeLastBoot, BOOT_KEY, greetingFor } from './bootMode'

const NOW = 1_800_000_000_000
describe('chooseBootMode', () => {
  it('plays the full splash on the first ever launch', () => expect(chooseBootMode({ now: NOW, lastBoot: null })).toBe('full'))
  it('plays quick on a relaunch inside the window', () => expect(chooseBootMode({ now: NOW, lastBoot: NOW - 60_000 })).toBe('quick'))
  it('plays full again after the gap', () => expect(chooseBootMode({ now: NOW, lastBoot: NOW - FULL_SPLASH_GAP_MS })).toBe('full'))
  it('never plays the long one for reduced motion', () => expect(chooseBootMode({ now: NOW, lastBoot: null, reduceMotion: true })).toBe('quick'))
  it('honours a forced mode, even over reduced motion', () => {
    expect(chooseBootMode({ now: NOW, lastBoot: NOW, force: 'full', reduceMotion: true })).toBe('full')
    expect(chooseBootMode({ now: NOW, lastBoot: null, force: 'quick' })).toBe('quick')
  })
  it('does not trust a clock that went backwards', () => expect(chooseBootMode({ now: NOW, lastBoot: NOW + 5_000 })).toBe('full'))
})
describe('storage helpers', () => {
  it('round-trips and survives broken storage', () => {
    const mem: Record<string, string> = {}
    const s = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v } }
    expect(readLastBoot(s)).toBeNull()
    writeLastBoot(s, NOW)
    expect(mem[BOOT_KEY]).toBe(String(NOW))
    expect(readLastBoot(s)).toBe(NOW)
    expect(readLastBoot({ getItem: () => { throw new Error('blocked') } })).toBeNull()
    expect(() => writeLastBoot({ setItem: () => { throw new Error('blocked') } }, NOW)).not.toThrow()
    expect(readLastBoot({ getItem: () => 'abc' })).toBeNull()
  })
})

describe('greetingFor', () => {
  it('follows the time of day', () => {
    expect(greetingFor(8, 'Deep')).toBe('Good morning, Deep')
    expect(greetingFor(12, 'Deep')).toBe('Good afternoon, Deep')
    expect(greetingFor(17, 'Deep')).toBe('Good afternoon, Deep')
    expect(greetingFor(19, 'Deep')).toBe('Good evening, Deep')
  })
  it('is warm but neutral in the small hours', () => {
    expect(greetingFor(2, 'Deep')).toBe('Welcome back, Deep')
    expect(greetingFor(22, 'Deep')).toBe('Welcome back, Deep')
  })
  it('copes with a missing or blank name', () => {
    expect(greetingFor(8, '')).toBe('Good morning')
    expect(greetingFor(8, '   ')).toBe('Good morning')
    expect(greetingFor(8, undefined)).toBe('Good morning')
  })
})
