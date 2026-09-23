import { describe, it, expect } from 'vitest'
import { parseVoiceTranscript, isSpeechRecognitionSupported } from './voiceInput'

describe('parseVoiceTranscript', () => {
  it('extracts a plain number and strips it from the description', () => {
    expect(parseVoiceTranscript('coffee 6.50')).toEqual({ description: 'Coffee', amount: 6.5 })
  })

  it('extracts a dollar-prefixed figure', () => {
    expect(parseVoiceTranscript('groceries $84.20')).toEqual({ description: 'Groceries', amount: 84.2 })
  })

  it('strips a trailing "dollars" word', () => {
    expect(parseVoiceTranscript('fuel 60 dollars')).toEqual({ description: 'Fuel', amount: 60 })
  })

  it('returns a null amount when no digits are spoken (word-numbers are not parsed)', () => {
    expect(parseVoiceTranscript('coffee at the cafe')).toEqual({ description: 'Coffee at the cafe', amount: null })
  })

  it('capitalizes the first letter of the remaining description', () => {
    expect(parseVoiceTranscript('personal spending 15')).toEqual({ description: 'Personal spending', amount: 15 })
  })

  it('handles a whole-number amount with no decimal', () => {
    expect(parseVoiceTranscript('parking 12')).toEqual({ description: 'Parking', amount: 12 })
  })
})

describe('isSpeechRecognitionSupported', () => {
  it('is a boolean and does not throw outside a real browser context', () => {
    expect(typeof isSpeechRecognitionSupported()).toBe('boolean')
  })
})
