import { describe, expect, it } from 'vitest'
import { shouldCaptureThumbnails, thumbsWanted, markThumbsWanted, THUMBS_WANTED_KEY, THUMBS_WANTED_EVENT } from './thumbnailPolicy'

describe('shouldCaptureThumbnails', () => {
  it('captures on a desktop with a hovering pointer', () => expect(shouldCaptureThumbnails({ hoverFine: true })).toBe(true))
  it('never captures on touch screens', () => expect(shouldCaptureThumbnails({ hoverFine: false })).toBe(false))
  it('respects data saver', () => expect(shouldCaptureThumbnails({ hoverFine: true, saveData: true })).toBe(false))
  it('skips very low memory devices but not unknown memory', () => {
    expect(shouldCaptureThumbnails({ hoverFine: true, deviceMemoryGb: 2 })).toBe(false)
    expect(shouldCaptureThumbnails({ hoverFine: true, deviceMemoryGb: 8 })).toBe(true)
    expect(shouldCaptureThumbnails({ hoverFine: true, deviceMemoryGb: undefined })).toBe(true)
  })
})

describe('previews are only wanted once Cmd+K has been used', () => {
  it('starts off, turns on once marked, and announces it', () => {
    const mem: Record<string, string> = {}
    const s = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v } }
    const events: string[] = []
    expect(thumbsWanted(s)).toBe(false)
    markThumbsWanted(s, (n) => events.push(n))
    expect(mem[THUMBS_WANTED_KEY]).toBe('1')
    expect(thumbsWanted(s)).toBe(true)
    expect(events).toEqual([THUMBS_WANTED_EVENT])
  })
  it('survives blocked storage', () => {
    expect(thumbsWanted({ getItem: () => { throw new Error('blocked') } })).toBe(false)
    expect(() => markThumbsWanted({ setItem: () => { throw new Error('blocked') } })).not.toThrow()
  })
})
