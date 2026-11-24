import { describe, expect, it } from 'vitest'
import { buildSinceLastVisit } from './sinceLastVisit'

const tx = (date: string, amount: number, category = 'Food') => ({ id: date + amount + category, date, amount, description: '', category }) as never
const base = { budgets: { Food: { monthly: 200 } }, todayIso: '2026-11-24' }

describe('buildSinceLastVisit', () => {
  it('says nothing on the same day, with no last visit, or with bad dates', () => {
    expect(buildSinceLastVisit({ ...base, transactions: [tx('2026-11-24', -50)], lastVisitIso: '2026-11-24' }).items).toEqual([])
    expect(buildSinceLastVisit({ ...base, transactions: [tx('2026-11-24', -50)], lastVisitIso: null }).items).toEqual([])
    expect(buildSinceLastVisit({ ...base, transactions: [], lastVisitIso: 'garbage' }).items).toEqual([])
  })
  it('counts only transactions after the last visit and up to today', () => {
    const r = buildSinceLastVisit({ ...base, lastVisitIso: '2026-11-20', transactions: [tx('2026-11-20', -999), tx('2026-11-21', -30), tx('2026-11-23', -20), tx('2026-11-22', 1250, 'Income'), tx('2026-11-30', -500)] })
    expect(r.daysAway).toBe(4)
    expect(r.items[0].text).toBe('3 new transactions since Friday: $50 spent, $1,250 in')
  })
  it('reports a target passed in the window, and one nearly reached', () => {
    const over = buildSinceLastVisit({ ...base, lastVisitIso: '2026-11-10', transactions: [tx('2026-11-05', -150), tx('2026-11-15', -100)] })
    expect(over.items.map((i) => i.text)).toContain('Food went over its $200 target')
    const near = buildSinceLastVisit({ ...base, lastVisitIso: '2026-11-10', transactions: [tx('2026-11-05', -100), tx('2026-11-15', -85)] })
    expect(near.items.map((i) => i.text)).toContain('Food is at 93% of its $200 target')
  })
  it('does not repeat a target that was already over before the visit', () => {
    const r = buildSinceLastVisit({ ...base, lastVisitIso: '2026-11-10', transactions: [tx('2026-11-05', -250), tx('2026-11-15', -10)] })
    expect(r.items.filter((i) => i.kind === 'budget')).toEqual([])
  })
  it('survives malformed rows', () => {
    const r = buildSinceLastVisit({ ...base, lastVisitIso: '2026-11-20', transactions: [null as never, { id: 'x' } as never, tx('2026-11-22', -10)] })
    expect(r.items[0].text).toBe('1 new transaction since Friday: $10 spent')
  })
})
