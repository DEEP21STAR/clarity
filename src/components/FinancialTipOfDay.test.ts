import { describe, expect, it } from 'vitest'
import { tipsForCountry } from './FinancialTipOfDay'

describe('tipsForCountry', () => {
  const tips = ['NZ: kiwisaver', 'AU: lito', 'plain tip', 'AU: wfh rate', 'NZ: acc levy']
  it('hides the other country\'s tips and keeps shared ones', () => {
    expect(tipsForCountry('NZ', tips)).toEqual(['NZ: kiwisaver', 'plain tip', 'NZ: acc levy'])
    expect(tipsForCountry('AU', tips)).toEqual(['AU: lito', 'plain tip', 'AU: wfh rate'])
  })
  it('the real tip list never ends up empty for either country', () => {
    expect(tipsForCountry('NZ').length).toBeGreaterThan(5)
    expect(tipsForCountry('AU').length).toBeGreaterThan(5)
  })
})
