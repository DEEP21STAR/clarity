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

describe('goalPace edge cases', () => {
  it('malformed or impossible dates are treated as no date', () => {
    for (const d of ['garbage', '2026-13-40', '2026-02-30', '', undefined]) expect(goalPace({ targetAmount: 100, contributedAmount: 10, targetDate: d as string }, '2026-11-29').state).toBe('no-date')
  })
  it('under a week shows the remaining amount, not a weekly figure', () => {
    const p = goalPace({ targetAmount: 100, contributedAmount: 0, targetDate: '2026-11-30' }, '2026-11-29')
    expect(p.short).toBe(true); expect(p.perWeek).toBe(0); expect(p.remaining).toBe(100)
    expect(goalPace({ targetAmount: 60, contributedAmount: 0, targetDate: '2026-12-05' }, '2026-11-29').short).toBe(true)
    expect(goalPace({ targetAmount: 60, contributedAmount: 0, targetDate: '2026-12-06' }, '2026-11-29').short).toBe(false)
  })
  it('due today is not overdue', () => {
    expect(goalPace({ targetAmount: 100, contributedAmount: 10, targetDate: '2026-11-29' }, '2026-11-29').state).toBe('due-today')
    expect(goalPace({ targetAmount: 100, contributedAmount: 10, targetDate: '2026-11-28' }, '2026-11-29').state).toBe('overdue')
  })
  it('works in whole cents', () => {
    expect(goalPace({ targetAmount: 0.3, contributedAmount: 0.1, targetDate: '2026-12-06' }, '2026-11-29').remaining).toBe(0.2)
    expect(goalPace({ targetAmount: 100.01, contributedAmount: 0, targetDate: '2026-12-06' }, '2026-11-29').perWeek).toBe(100.01)
  })
  it('a zero target has no pace', () => { expect(goalPace({ targetAmount: 0, contributedAmount: 0, targetDate: '2027-01-29' }, '2026-11-29').state).toBe('no-date') })
})
