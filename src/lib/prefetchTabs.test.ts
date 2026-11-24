import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { schedulePrefetch, shouldPrefetch } from './prefetchTabs'

describe('shouldPrefetch', () => {
  it('is on without connection info, off for data saver and slow connections', () => {
    expect(shouldPrefetch({})).toBe(true)
    expect(shouldPrefetch({ connection: { saveData: true } })).toBe(false)
    expect(shouldPrefetch({ connection: { effectiveType: '2g' } })).toBe(false)
    expect(shouldPrefetch({ connection: { effectiveType: '3g' } })).toBe(false)
    expect(shouldPrefetch({ connection: { effectiveType: '4g' } })).toBe(true)
  })
})

describe('schedulePrefetch', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })
  const immediate = (cb: () => void) => cb()

  it('loads each screen once, in order, one at a time, after the start delay', async () => {
    const order: string[] = []
    const mk = (n: string) => () => { order.push(n); return Promise.resolve() }
    schedulePrefetch([mk('a'), mk('b'), mk('c')], { startDelayMs: 1000, gapMs: 500, idle: immediate, allowed: true })
    await vi.advanceTimersByTimeAsync(999)
    expect(order).toEqual([])
    await vi.advanceTimersByTimeAsync(2)
    expect(order).toEqual(['a'])
    await vi.advanceTimersByTimeAsync(600)
    expect(order).toEqual(['a', 'b'])
    await vi.advanceTimersByTimeAsync(600)
    expect(order).toEqual(['a', 'b', 'c'])
    await vi.advanceTimersByTimeAsync(5000)
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('keeps going after a loader fails, and does nothing when not allowed or stopped', async () => {
    const order: string[] = []
    schedulePrefetch([() => Promise.reject(new Error('offline')), () => { order.push('b'); return Promise.resolve() }], { startDelayMs: 10, gapMs: 10, idle: immediate, allowed: true })
    await vi.advanceTimersByTimeAsync(100)
    expect(order).toEqual(['b'])

    const never: string[] = []
    schedulePrefetch([() => { never.push('x'); return Promise.resolve() }], { startDelayMs: 10, idle: immediate, allowed: false })
    const stop = schedulePrefetch([() => { never.push('y'); return Promise.resolve() }], { startDelayMs: 10, idle: immediate, allowed: true })
    stop()
    await vi.advanceTimersByTimeAsync(1000)
    expect(never).toEqual([])
  })
})
