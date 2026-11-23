import { describe, expect, it } from 'vitest'
import { caretAfterDigits, digitsBeforeCaret, groupMoney, parseMoney } from './moneyInput'

describe('moneyInput', () => {
  it('parses typed text to a number', () => {
    expect(parseMoney('65,000')).toBe(65000)
    expect(parseMoney('$1 200.50')).toBe(1200.5)
    expect(parseMoney('')).toBe(0)
    expect(parseMoney('abc')).toBe(0)
    expect(parseMoney('1.2.3')).toBe(1.23)
  })
  it('groups thousands as you type', () => {
    expect(groupMoney('65000')).toBe('65,000')
    expect(groupMoney('1234567')).toBe('1,234,567')
    expect(groupMoney('999')).toBe('999')
    expect(groupMoney('')).toBe('')
    expect(groupMoney('007')).toBe('7')
  })
  it('keeps a trailing dot and caps decimals at 2', () => {
    expect(groupMoney('1200.')).toBe('1,200.')
    expect(groupMoney('1200.567')).toBe('1,200.56')
    expect(groupMoney('.5')).toBe('0.5')
  })
})

describe('caret helpers', () => {
  it('counts digits before the caret and finds the matching spot after reformatting', () => {
    expect(digitsBeforeCaret('1923', 2)).toBe(2)
    expect(digitsBeforeCaret('1,923', 3)).toBe(2) // "1,9|23"
    expect(caretAfterDigits('1,923', 2)).toBe(3) // right after the 9, past the comma
    expect(caretAfterDigits('1,923', 0)).toBe(0)
    expect(caretAfterDigits('1,923', 9)).toBe(5)
    expect(caretAfterDigits('1,200.5', 5)).toBe(6) // right after the point
    expect(caretAfterDigits('1,200.5', 6)).toBe(7)
  })
})
