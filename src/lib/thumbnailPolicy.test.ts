import { describe, expect, it } from 'vitest'
import { shouldCaptureThumbnails } from './thumbnailPolicy'

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
