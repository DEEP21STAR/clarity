import { describe, expect, it } from 'vitest'
import { goalPace, milestone } from '@/lib/goalPace'

describe('goalPace', () => {
  it('done when fully funded', () => { expect(goalPace({ targetAmount: 500, contributedAmount: 500 }, '2026-11-29').state).toBe('done') })
  it('no date means no pace', () => { expect(goalPace({ targetAmount: 500, contributedAmount: 100 }, '2026-11-29').state).toBe('no-date') })
  it('per week to hit the date', () => {
    const p = goalPace({ targetAmount: 1000, contributedAmount: 300, targetDate: '2026-12-27' }, '2026-11-29')
    expect(p.daysLeft).toBe(28); expect(p.perWeek).toBe(175); expect(p.state).toBe('running')
  })
  it('on track compares funding to the need', () => {
    const g = { targetAmount: 1000, contributedAmount: 300, targetDate: '2026-12-27' }
    expect(goalPace(g, '2026-11-29', 200).onTrack).toBe(true)
    expect(goalPace(g, '2026-11-29', 100).onTrack).toBe(false)
  })
  it('overdue when the date has passed', () => { expect(goalPace({ targetAmount: 100, contributedAmount: 10, targetDate: '2026-11-01' }, '2026-11-29').state).toBe('overdue') })
  it('milestones', () => { expect([0, 24.9, 25, 60, 80, 100].map(milestone)).toEqual([0, 0, 25, 50, 75, 100]) })
})
