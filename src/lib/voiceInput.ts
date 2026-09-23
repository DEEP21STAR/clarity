// Real Web Speech API integration for voice quick-log. Honest scope: only Chrome/Edge/Safari
// implement SpeechRecognition (as the webkit-prefixed global) — Firefox has no implementation
// at all, so isSpeechRecognitionSupported() must be checked and disclosed, not assumed.
// Deliberately does NOT try to guess a category or income/expense sign from the transcript —
// it extracts a description and a plain positive amount, and leaves the sign/category to the
// user to confirm in the form, exactly as manual entry already requires.

interface MinimalSpeechRecognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } }; length: number } }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function getRecognitionCtor(): (new () => MinimalSpeechRecognition) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => MinimalSpeechRecognition; webkitSpeechRecognition?: new () => MinimalSpeechRecognition }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null
}

export interface VoiceListener {
  stop: () => void
}

/** Starts listening once; calls onResult with the final transcript, or onError with a short
 * reason ('no-speech' | 'not-allowed' | 'audio-capture' | 'other'). Caller decides what to show. */
export function startListening(onResult: (transcript: string) => void, onError: (reason: string) => void): VoiceListener | null {
  const Ctor = getRecognitionCtor()
  if (!Ctor) return null
  const recognizer = new Ctor()
  recognizer.lang = 'en-NZ'
  recognizer.interimResults = false
  recognizer.maxAlternatives = 1
  recognizer.continuous = false
  recognizer.onresult = (event) => {
    const transcript = event.results[event.results.length - 1]?.[0]?.transcript ?? ''
    if (transcript) onResult(transcript)
  }
  recognizer.onerror = (event) => onError(event.error || 'other')
  try {
    recognizer.start()
  } catch {
    onError('other')
    return null
  }
  return { stop: () => recognizer.stop() }
}

export interface ParsedVoiceEntry {
  description: string
  amount: number | null
}

/** Pulls the first dollar figure out of a spoken transcript ("coffee at the cafe six fifty" ->
 * amount null, since spoken word-numbers aren't parsed — only digits/decimals are; "coffee 6.50"
 * or "coffee $6.50" -> amount 6.5). Whatever's left, with the matched number and stray "dollars"
 * words removed, becomes the description. Never guesses a sign or category. */
export function parseVoiceTranscript(transcript: string): ParsedVoiceEntry {
  const match = transcript.match(/\$?\s*(\d+(?:\.\d{1,2})?)/)
  const amount = match ? parseFloat(match[1]) : null
  let description = transcript
  if (match) description = description.replace(match[0], ' ')
  description = description.replace(/\bdollars?\b/gi, ' ').replace(/\s+/g, ' ').trim()
  if (description.length > 0) description = description[0].toUpperCase() + description.slice(1)
  return { description, amount }
}
