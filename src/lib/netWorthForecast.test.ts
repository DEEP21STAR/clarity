import { describe, expect, it } from 'vitest'
import { forecastNetWorth } from './netWorthForecast'

describe('forecastNetWorth', () => {
  it('adds what is left after bills each month, starting from today', () => {
    const f = forecastNetWorth({ netWorthNow: 10000, monthlyNetIncome: 4000, monthlyBills: 2500, todayIso: '2026-11-25' })!
    expect(f.monthlyChange).toBe(1500)
    expect(f.points).toHaveLength(7)
    expect(f.points[0]).toEqual({ monthsAhead: 0, label: 'Now', value: 10000 })
    expect(f.points.map((p) => p.label)).toEqual(['Now', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'])
    expect(f.end).toBe(19000)
    expect(f.change).toBe(9000)
  })
  it('goes down when bills are more than income', () => {
    const f = forecastNetWorth({ netWorthNow: 1000, monthlyNetIncome: 2000, monthlyBills: 2600, todayIso: '2026-01-31', months: 3 })!
    expect(f.monthlyChange).toBe(-600)
    expect(f.end).toBe(-800)
    expect(f.points.map((p) => p.label)).toEqual(['Now', 'Feb', 'Mar', 'Apr'])
  })
  it('says nothing without a usable income or with bad numbers', () => {
    expect(forecastNetWorth({ netWorthNow: 0, monthlyNetIncome: 0, monthlyBills: 100, todayIso: '2026-11-25' })).toBeNull()
    expect(forecastNetWorth({ netWorthNow: NaN, monthlyNetIncome: 100, monthlyBills: 10, todayIso: '2026-11-25' })).toBeNull()
    expect(forecastNetWorth({ netWorthNow: 0, monthlyNetIncome: 100, monthlyBills: 10, todayIso: 'nope' })).toBeNull()
  })
  it('caps the horizon at 24 months and treats negative bills as zero', () => {
    const f = forecastNetWorth({ netWorthNow: 0, monthlyNetIncome: 100, monthlyBills: -50, todayIso: '2026-11-25', months: 99 })!
    expect(f.points).toHaveLength(25)
    expect(f.monthlyChange).toBe(100)
  })
})
