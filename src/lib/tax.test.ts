import { describe, it, expect } from 'vitest'
import { nzIncomeTax, nzAccLevy, nzNetIncome, auIncomeTax, auMedicareLevy, auLito, auNetIncome, gstOnExclusive, gstFromInclusive } from './logic'

describe('NZ income tax (2026-27 brackets: 10.5/17.5/30/33/39%)', () => {
  it('charges 10.5% flat within the bottom bracket', () => {
    expect(nzIncomeTax(15600)).toBeCloseTo(15600 * 0.105, 2)
  })
  it('matches a known multi-bracket example: $70,000', () => {
    // 15600*0.105 + (53500-15600)*0.175 + (70000-53500)*0.30
    const expected = 15600 * 0.105 + (53500 - 15600) * 0.175 + (70000 - 53500) * 0.30
    expect(nzIncomeTax(70000)).toBeCloseTo(expected, 2)
  })
  it('matches a known example spanning the top bracket: $200,000', () => {
    const expected =
      15600 * 0.105 +
      (53500 - 15600) * 0.175 +
      (78100 - 53500) * 0.30 +
      (180000 - 78100) * 0.33 +
      (200000 - 180000) * 0.39
    expect(nzIncomeTax(200000)).toBeCloseTo(expected, 2)
  })
  it('is zero for zero income', () => {
    expect(nzIncomeTax(0)).toBe(0)
  })
})

describe('NZ ACC earner levy (1.75%, cap $156,641)', () => {
  it('charges 1.75% below the cap', () => {
    expect(nzAccLevy(70000)).toBeCloseTo(70000 * 0.0175, 2)
  })
  it('caps liable earnings at $156,641', () => {
    expect(nzAccLevy(200000)).toBeCloseTo(156641 * 0.0175, 2)
  })
  it('net income subtracts both tax and ACC levy', () => {
    const result = nzNetIncome(70000)
    expect(result.net).toBeCloseTo(70000 - result.tax - result.accLevy, 2)
  })
})

describe('AU income tax (2026-27 brackets: 0/15/30/37/45%)', () => {
  it('is tax free under $18,200', () => {
    expect(auIncomeTax(18200)).toBe(0)
  })
  it('matches a known example: $80,000', () => {
    const expected = (45000 - 18200) * 0.15 + (80000 - 45000) * 0.30
    expect(auIncomeTax(80000)).toBeCloseTo(expected, 2)
  })
  it('matches a known example spanning the top bracket: $250,000', () => {
    const expected =
      (45000 - 18200) * 0.15 +
      (135000 - 45000) * 0.30 +
      (190000 - 135000) * 0.37 +
      (250000 - 190000) * 0.45
    expect(auIncomeTax(250000)).toBeCloseTo(expected, 2)
  })
})

describe('AU Medicare levy (2%, phases in from $28,011)', () => {
  it('is zero below the low-income threshold', () => {
    expect(auMedicareLevy(20000)).toBe(0)
  })
  it('charges 2% above the threshold', () => {
    expect(auMedicareLevy(80000)).toBeCloseTo(80000 * 0.02, 2)
  })
})

describe('AU Low Income Tax Offset (max $700, full to $37,500, zero at $66,667)', () => {
  it('gives the full $700 at or below $37,500', () => {
    expect(auLito(37500)).toBe(700)
    expect(auLito(20000)).toBe(700)
  })
  it('tapers to roughly $0 by $66,667', () => {
    expect(auLito(66667)).toBeLessThanOrEqual(5)
    expect(auLito(66667)).toBeGreaterThanOrEqual(0)
  })
  it('is between the two bounds partway through stage 1', () => {
    const val = auLito(40000)
    expect(val).toBeLessThan(700)
    expect(val).toBeGreaterThan(0)
  })
  it('auNetIncome nets out tax-after-offset and medicare levy', () => {
    const r = auNetIncome(50000)
    expect(r.net).toBeCloseTo(50000 - r.tax - r.medicareLevy, 2)
    expect(r.tax).toBeGreaterThanOrEqual(0)
  })
})

describe('GST math', () => {
  it('NZ 15%: $100 ex-GST -> $15 GST, $115 inc-GST', () => {
    const r = gstOnExclusive(100, 'NZ')
    expect(r.gst).toBeCloseTo(15, 2)
    expect(r.amountIncGst).toBeCloseTo(115, 2)
  })
  it('NZ 15%: $115 inc-GST backs out to $100 ex-GST, $15 GST', () => {
    const r = gstFromInclusive(115, 'NZ')
    expect(r.amountExGst).toBeCloseTo(100, 2)
    expect(r.gst).toBeCloseTo(15, 2)
  })
  it('AU 10%: $100 ex-GST -> $10 GST, $110 inc-GST', () => {
    const r = gstOnExclusive(100, 'AU')
    expect(r.gst).toBeCloseTo(10, 2)
    expect(r.amountIncGst).toBeCloseTo(110, 2)
  })
})
