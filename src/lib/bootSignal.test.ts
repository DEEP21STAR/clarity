import { beforeEach, describe, expect, it } from 'vitest'
import { markBooted, resetBootSignal, whenBooted } from './bootSignal'

describe('bootSignal', () => {
  beforeEach(() => resetBootSignal())
  it('waits for the intro to finish, then fires once', () => {
    let n = 0
    whenBooted(() => { n++ })
    expect(n).toBe(0)
    markBooted(); markBooted()
    expect(n).toBe(1)
  })
  it('fires immediately when the intro already finished', () => {
    markBooted()
    let n = 0
    whenBooted(() => { n++ })
    expect(n).toBe(1)
  })
  it('can be cancelled before it fires', () => {
    let n = 0
    const cancel = whenBooted(() => { n++ })
    cancel()
    markBooted()
    expect(n).toBe(0)
  })
})
