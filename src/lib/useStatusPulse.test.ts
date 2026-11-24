import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useStatusPulse } from './useStatusPulse'

describe('useStatusPulse', () => {
  it('does not pulse on first render', () => {
    const { result } = renderHook(() => useStatusPulse(false))
    expect(result.current).toBe(false)
  })
  it('pulses once when the status changes, then settles', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ s }) => useStatusPulse(s, 1000), { initialProps: { s: false } })
    rerender({ s: true })
    expect(result.current).toBe(true)
    act(() => { vi.advanceTimersByTime(1001) })
    expect(result.current).toBe(false)
    vi.useRealTimers()
  })
  it('does not pulse when the status stays the same', () => {
    const { result, rerender } = renderHook(({ s }) => useStatusPulse(s), { initialProps: { s: 'ok' } })
    rerender({ s: 'ok' })
    expect(result.current).toBe(false)
  })
})
