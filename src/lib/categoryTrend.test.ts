import { describe, expect, it } from 'vitest'
import { categoryTrend, monthEndPace, spentInMonthUpTo, trendSentence } from './categoryTrend'

const tx = (date: string, amount: number, category = 'Food') => ({ id: date + amount, date, amount, description: '', category }) as never
const txs = [tx('2026-10-03', -100), tx('2026-10-20', -300), tx('2026-11-02', -150), tx('2026-09-05', -50), tx('2026-11-03', 500, 'Income')]

describe('categoryTrend', () => {
  it('builds a six-month series ending this month', () => {
    const t = categoryTrend(txs, 'Food', '2026-11-10')
    expect(t.series).toEqual([0, 0, 0, 50, 400, 150])
    expect(t.monthsWithSpend).toBe(3)
  })
  it('compares like for like by day of month', () => {
    expect(spentInMonthUpTo(txs, 'Food', '2026-10', 10)).toBe(100)
    const t = categoryTrend(txs, 'Food', '2026-11-10')
    expect(t.lastSameDay).toBe(100)
    expect(t.changeVsLast).toBe(0.5)
    expect(trendSentence(t, 150)).toBe('Up 50% on this point last month ($150 vs $100)')
  })
  it('says nothing when last month has no spend, and "about the same" under 5%', () => {
    expect(trendSentence(categoryTrend(txs, 'Fuel', '2026-11-10'), 0)).toBeNull()
    const same = categoryTrend([tx('2026-10-02', -100), tx('2026-11-02', -102)], 'Food', '2026-11-10')
    expect(trendSentence(same, 102)).toBe('About the same as this point last month')
  })
  it('says "Down" when spending is lower', () => {
    const t = categoryTrend([tx('2026-10-02', -200), tx('2026-11-02', -100)], 'Food', '2026-11-10')
    expect(trendSentence(t, 100)).toBe('Down 50% on this point last month ($100 vs $200)')
  })
  it('ignores income, and does not throw on malformed rows', () => {
    const bad = [...txs, { id: 'x' } as never, null as never]
    expect(categoryTrend(bad, 'Food', '2026-11-10').series[5]).toBe(150)
  })
})

describe('monthEndPace', () => {
  it('projects the month from the daily rate and says how far over', () => {
    expect(monthEndPace(150, 400, 10, 30)).toEqual({ projected: 450, over: 50 })
    expect(monthEndPace(100, 400, 10, 30)).toEqual({ projected: 300, over: 0 })
  })
  it('stays quiet when it is too early, nothing is spent, there is no target, or the month is over', () => {
    expect(monthEndPace(150, 400, 6, 30)).toBeNull()
    expect(monthEndPace(0, 400, 15, 30)).toBeNull()
    expect(monthEndPace(150, 0, 15, 30)).toBeNull()
    expect(monthEndPace(150, 400, 30, 30)).toBeNull()
    expect(monthEndPace(NaN, 400, 15, 30)).toBeNull()
  })
})
