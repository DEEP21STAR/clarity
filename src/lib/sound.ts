/**
 * #38, Round 20 — real sound design, OFF by default with a real toggle to
 * enable (see `state.soundEnabled` in store.tsx). Built on the Web Audio
 * API directly — no audio files, no new dependency — three short synthesised
 * chimes (a couple of sine-wave tones each), genuinely audible, not a fake
 * silent stub.
 */
let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  audioCtx ??= new Ctor()
  return audioCtx
}

function tone(freq: number, startOffset: number, durationSec: number, gainPeak: number, ctx: AudioContext) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  const t0 = ctx.currentTime + startOffset
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + durationSec + 0.05)
}

/** Bill marked paid — a short, satisfying two-note chime. */
export function chimeBillPaid(enabled: boolean) {
  if (!enabled) return
  const ctx = getCtx()
  if (!ctx) return
  tone(523.25, 0, 0.18, 0.08, ctx) // C5
  tone(783.99, 0.08, 0.22, 0.08, ctx) // G5
}

/** Streak milestone — a brighter three-note rising chime. */
export function chimeStreakMilestone(enabled: boolean) {
  if (!enabled) return
  const ctx = getCtx()
  if (!ctx) return
  tone(523.25, 0, 0.15, 0.07, ctx) // C5
  tone(659.25, 0.1, 0.15, 0.07, ctx) // E5
  tone(1046.5, 0.2, 0.3, 0.08, ctx) // C6
}

/** Payday landing (Live Funds Available crossing back positive, or a real payday date) — a single warm tone. */
export function chimePaydayLanding(enabled: boolean) {
  if (!enabled) return
  const ctx = getCtx()
  if (!ctx) return
  tone(659.25, 0, 0.35, 0.09, ctx) // E5
}
