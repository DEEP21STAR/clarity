import { describe, it, expect } from 'vitest'
import { getPlanSeverity, requiredMonthlyPayment, planProgressPercent, suggestedFortnightlySetAside, daysRemainingInPeriod, periodProgressPercent, totalPeriodicSmoothedInWindow } from './logic'
import { SEED_CREDIT_CARDS, SEED_PERIODIC_BILLS } from './constants'
import type { InstallmentPlan, PeriodicBill } from './types'

const deepCard = SEED_CREDIT_CARDS.find((c) => c.id === 'card-gem-visa-deep')!
const mimiCard = SEED_CREDIT_CARDS.find((c) => c.id === 'card-gem-visa-mimi')!

describe('installment plan severity — real GEM VISA data given 2026-09-10', () => {
  it('"Purchases May–Jun 2026" ($1,762.22 / 3mo = $587.41/mo) is NOT amber — below the judgment-call threshold', () => {
    const plan = deepCard.plans.find((p) => p.name === 'Purchases May–Jun 2026')!
    expect(requiredMonthlyPayment(plan)).toBeCloseTo(587.41, 2)
    expect(getPlanSeverity(plan)).toBe('normal')
  })

  it('"Purchases Jun–Jul 2026" ($5,119.73 / 4mo = $1,279.93/mo) IS amber — the one Deep flagged as genuinely high-risk', () => {
    const plan = deepCard.plans.find((p) => p.name === 'Purchases Jun–Jul 2026')!
    expect(requiredMonthlyPayment(plan)).toBeCloseTo(1279.93, 2)
    expect(getPlanSeverity(plan)).toBe('amber')
  })

  it('the two long-tenor Good Guys plans are normal (low required-monthly)', () => {
    const hoppers = deepCard.plans.find((p) => p.name === 'The Good Guys Hoppers CRO')!
    const online = deepCard.plans.find((p) => p.name === 'The Good Guys Online Store')!
    expect(getPlanSeverity(hoppers)).toBe('normal')
    expect(getPlanSeverity(online)).toBe('normal')
  })

  it("Mimi's two expired plans are 'red' unconditionally, regardless of required-monthly math", () => {
    for (const plan of mimiCard.plans) {
      expect(plan.expired).toBe(true)
      expect(getPlanSeverity(plan)).toBe('red')
    }
  })

  it('a plan whose remaining balance exceeds its original total (post-expiry interest) is never clamped, and progress floors at 0%', () => {
    const overAccrued = mimiCard.plans.find((p) => p.name === 'Gem Visa interest free #2')!
    expect(overAccrued.remaining).toBeGreaterThan(overAccrued.total)
    expect(planProgressPercent(overAccrued)).toBe(0)
  })

  it('progress percent is paid-off fraction, clamped to [0,100]', () => {
    const plan: InstallmentPlan = { id: 'x', name: 'x', total: 1000, remaining: 250, monthsTotal: 10, monthsRemaining: 5, expired: false }
    expect(planProgressPercent(plan)).toBeCloseTo(75, 2)
  })
})

describe('periodic bill gauge + fortnightly smoothing — real Gas/Electricity data given 2026-09-10', () => {
  const gas = SEED_PERIODIC_BILLS.find((b) => b.id === 'periodic-gas')!
  const electricity = SEED_PERIODIC_BILLS.find((b) => b.id === 'periodic-electricity')!
  const today = '2026-09-10'

  it('Gas: 48 days remain in the in-progress period (29 Aug – 28 Oct 2026) from today', () => {
    expect(daysRemainingInPeriod(gas.gaugePeriodEnd, today)).toBe(48)
  })

  it('Gas: not in credit, so suggested fortnightly = projected ÷ fortnights remaining (no credit offset)', () => {
    const fortnights = 48 / 14
    expect(suggestedFortnightlySetAside(gas, today)).toBeCloseTo(369.18 / fortnights, 1)
  })

  it('Electricity: in credit, so the $82.70 credit reduces the suggested fortnightly amount', () => {
    const daysLeft = daysRemainingInPeriod(electricity.gaugePeriodEnd, today)
    const fortnights = daysLeft / 14
    const expected = (341.97 - 82.70) / fortnights
    expect(suggestedFortnightlySetAside(electricity, today)).toBeCloseTo(expected, 1)
    expect(suggestedFortnightlySetAside(electricity, today)).toBeLessThan(341.97 / fortnights)
  })

  it('period progress percent is 0 at period start and 100 at/after period end', () => {
    expect(periodProgressPercent('2026-08-29', '2026-10-28', '2026-08-29')).toBe(0)
    expect(periodProgressPercent('2026-08-29', '2026-10-28', '2026-10-28')).toBe(100)
    expect(periodProgressPercent('2026-08-29', '2026-10-28', '2026-12-01')).toBe(100) // clamped, never over
  })

  it('a bill with zero days remaining floors at the minimum-fortnights divisor rather than exploding to infinity', () => {
    const endingToday: PeriodicBill = { ...gas, gaugePeriodEnd: today }
    const result = suggestedFortnightlySetAside(endingToday, today)
    expect(Number.isFinite(result)).toBe(true)
    expect(result).toBeGreaterThan(0)
  })

  it('totalPeriodicSmoothedInWindow sums both bills, prorated like a fortnightly recurring cost over the window', () => {
    const windowDays = 7
    const end = '2026-09-16'
    const perBillDaily7 = (bill: PeriodicBill) => suggestedFortnightlySetAside(bill, today) * (windowDays / 14)
    const expected = perBillDaily7(gas) + perBillDaily7(electricity)
    expect(totalPeriodicSmoothedInWindow([gas, electricity], today, end, today)).toBeCloseTo(expected, 1)
  })

  it('a bill with smoothingEnabled=false is excluded from the window total entirely (informational only, per the add/edit form toggle)', () => {
    const end = '2026-09-16'
    const gasWithSmoothingOff: PeriodicBill = { ...gas, smoothingEnabled: false }
    const windowDays = 7
    const electricityOnly = suggestedFortnightlySetAside(electricity, today) * (windowDays / 14)
    expect(totalPeriodicSmoothedInWindow([gasWithSmoothingOff, electricity], today, end, today)).toBeCloseTo(electricityOnly, 1)
  })

  it('a brand-new bill added via the form (no pendingBill, smoothingEnabled true) still produces a sane suggested fortnightly figure', () => {
    const newBill: PeriodicBill = {
      id: 'periodic-new',
      name: 'Water (usage)',
      gaugePeriodStart: '2026-09-01',
      gaugePeriodEnd: '2026-11-30',
      projectedCharge: 120,
      inCredit: false,
      creditAmount: 0,
      smoothingEnabled: true,
      owner: 'shared',
    }
    const result = suggestedFortnightlySetAside(newBill, today)
    expect(result).toBeGreaterThan(0)
    expect(Number.isFinite(result)).toBe(true)
  })
})
