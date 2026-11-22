import { describe, expect, it } from 'vitest'
import { normaliseDate, previewCsvImport, txKey } from './csvImport'
import type { Transaction } from './types'

describe('normaliseDate', () => {
  it('reads NZ day-first dates, ISO, and month names', () => {
    expect(normaliseDate('21/11/2026')).toBe('2026-11-21')
    expect(normaliseDate('5/6/26')).toBe('2026-06-05')
    expect(normaliseDate('2026-11-21')).toBe('2026-11-21')
    expect(normaliseDate('2026/11/21 14:03')).toBe('2026-11-21')
    expect(normaliseDate('21 Nov 2026')).toBe('2026-11-21')
    expect(normaliseDate('21-Nov-26')).toBe('2026-11-21')
    expect(normaliseDate('21.11.2026')).toBe('2026-11-21')
  })
  it('an ambiguous date follows the day-first flag; an impossible reading flips', () => {
    expect(normaliseDate('05/06/2026', true)).toBe('2026-06-05')
    expect(normaliseDate('05/06/2026', false)).toBe('2026-05-06')
    expect(normaliseDate('11/21/2026', true)).toBe('2026-11-21') // month 21 is impossible, so month-first
  })
  it('rejects junk and non-dates', () => {
    for (const bad of ['', '   ', 'abc', '31/02/2026', '32/01/2026', '2026-13-01', '12.50', '99/99/9999']) expect(normaliseDate(bad)).toBeNull()
  })
})

const STATEMENT = `Date,Description,Amount
21/11/2026,COUNTDOWN WELLINGTON,-84.20
21/11/2026,"Rent, week 47",-400.00
22/11/2026,SALARY ACME LTD,1850.50
bad date,Mystery,-5.00
23/11/2026,No amount here,
`
describe('previewCsvImport', () => {
  it('imports good rows with ISO dates, categories and cents, and reports the bad ones', () => {
    const p = previewCsvImport(STATEMENT, 'personal')
    expect(p.fresh.map((t) => [t.date, t.amount])).toEqual([['2026-11-21', -84.2], ['2026-11-21', -400], ['2026-11-22', 1850.5]])
    expect(p.fresh[0].category).toBe('Groceries')
    expect(p.fresh[1].description).toBe('Rent, week 47')
    expect(p.skipped.map((s) => [s.line, s.reason])).toEqual([[5, 'no readable date'], [6, 'no amount']])
    expect(p.income).toBe(1850.5)
    expect(p.spend).toBe(484.2)
    expect([p.firstDate, p.lastDate]).toEqual(['2026-11-21', '2026-11-22'])
  })
  it('debit and credit columns combine into one signed amount', () => {
    const p = previewCsvImport('Date,Details,Debit,Credit\n01/12/2026,Coffee,4.50,\n02/12/2026,Refund,,12.00\n', 'personal')
    expect(p.fresh.map((t) => t.amount)).toEqual([-4.5, 12])
  })
  it('importing the same statement twice adds nothing the second time', () => {
    const first = previewCsvImport(STATEMENT, 'personal')
    const second = previewCsvImport(STATEMENT, 'personal', first.fresh)
    expect(second.fresh).toEqual([])
    expect(second.duplicates).toHaveLength(3)
  })
  it('two identical same-day purchases in one file are both kept; a re-import matches each once', () => {
    const csv = 'Date,Description,Amount\n01/12/2026,BUS FARE,-3.00\n01/12/2026,BUS FARE,-3.00\n'
    const first = previewCsvImport(csv, 'personal')
    expect(first.fresh).toHaveLength(2)
    expect(new Set(first.fresh.map((t) => t.id)).size).toBe(2)
    const overlap = previewCsvImport(csv + '02/12/2026,BUS FARE,-3.00\n', 'personal', first.fresh)
    expect(overlap.fresh.map((t) => t.date)).toEqual(['2026-12-02'])
    expect(overlap.duplicates).toHaveLength(2)
  })
  it('a month-first file (US style) is read correctly because a day above 12 proves it', () => {
    const p = previewCsvImport('Date,Description,Amount\n11/21/2026,X,-1\n12/05/2026,Y,-2\n', 'personal')
    expect(p.fresh.map((t) => t.date)).toEqual(['2026-11-21', '2026-12-05'])
  })
  it('matches an existing ledger row regardless of case and punctuation in the description', () => {
    const existing: Transaction[] = [{ id: 'x', date: '2026-11-21', description: 'countdown  wellington', amount: -84.2, category: 'Groceries', mode: 'personal' }]
    const p = previewCsvImport(STATEMENT, 'personal', existing)
    expect(p.duplicates).toHaveLength(1)
    expect(p.fresh).toHaveLength(2)
    expect(txKey(existing[0])).toBe(txKey(p.duplicates[0]))
  })
  it('an empty or header-only file gives an empty preview, not a crash', () => {
    expect(previewCsvImport('', 'personal').fresh).toEqual([])
    expect(previewCsvImport('Date,Description,Amount\n', 'personal').fresh).toEqual([])
  })
})

import { recategorisePreview, categoryCounts } from './csvImport'
describe('recategorisePreview', () => {
  const csv = 'Date,Description,Amount\n01/11/2026,ZZ CORNER DAIRY 123,-5.00\n02/11/2026,ZZ CORNER DAIRY 456,-6.00\n03/11/2026,OTHER SHOP,-7.00\n'
  it('sets the category on the chosen row and every same-merchant row only', () => {
    const p = previewCsvImport(csv, 'personal', [])
    const first = p.fresh[0].id
    const r = recategorisePreview(p, first, 'Groceries')
    expect(r.fresh.map((t) => t.category)).toEqual(['Groceries', 'Groceries', 'uncategorised'])
    expect(p.fresh[0].category).toBe('uncategorised') // original untouched
  })
  it('ignores empty categories and unknown ids', () => {
    const p = previewCsvImport(csv, 'personal', [])
    expect(recategorisePreview(p, p.fresh[0].id, '  ')).toBe(p)
    expect(recategorisePreview(p, 'nope', 'X')).toBe(p)
  })
  it('counts categories with uncategorised last', () => {
    const p = recategorisePreview(previewCsvImport(csv, 'personal', []), previewCsvImport(csv, 'personal', []).fresh[2].id, 'Shopping')
    expect(categoryCounts(p.fresh)).toEqual([{ category: 'Shopping', count: 1 }, { category: 'uncategorised', count: 2 }])
  })
})

describe('learning categories from the existing ledger', () => {
  const csv = 'Date,Description,Amount\n05/11/2026,COUNTDOWN WELLINGTON 4411,-50.00\n06/11/2026,ZZ NEW SHOP,-9.00\n'
  const filed = { id: 'x1', date: '2026-10-01', amount: -30, description: 'COUNTDOWN WELLINGTON 9020', category: 'Weekly shop', mode: 'personal' } as Transaction
  it('uses how the same merchant is already filed, over the keyword guess', () => {
    const p = previewCsvImport(csv, 'personal', [filed])
    expect(p.fresh.find((x) => x.description.startsWith('COUNTDOWN'))?.category).toBe('Weekly shop')
    expect(p.learned).toBe(1)
  })
  it('falls back to keywords and ignores uncategorised history', () => {
    const p = previewCsvImport(csv, 'personal', [{ ...filed, category: 'uncategorised' }])
    expect(p.fresh.find((x) => x.description.startsWith('COUNTDOWN'))?.category).toBe('Groceries')
    expect(p.learned).toBe(0)
  })
  it('picks the most common category when a merchant was filed two ways', () => {
    const p = previewCsvImport(csv, 'personal', [filed, { ...filed, id: 'x2', category: 'Food' }, { ...filed, id: 'x3' }])
    expect(p.fresh.find((x) => x.description.startsWith('COUNTDOWN'))?.category).toBe('Weekly shop')
  })
})
