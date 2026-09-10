import confetti from 'canvas-confetti'

const PALETTE = ['#22d3ee', '#a855f7', '#ec4899', '#34d399', '#f59e0b']

/** Standard celebration burst — debt paid off, funds back to positive, streak milestones. */
export function fireConfetti() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: PALETTE, scalar: 0.9 })
  confetti({ particleCount: 50, spread: 100, origin: { y: 0.6 }, colors: PALETTE, scalar: 1.2, startVelocity: 45 })
}

/** Bigger burst for the largest moments (debt fully paid off). */
export function fireBigConfetti() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const end = Date.now() + 700
  const frame = () => {
    confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0 }, colors: PALETTE })
    confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1 }, colors: PALETTE })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

// ---------------------------------------------------------------------------
// #17, Round 20 — achievement-specific confetti SHAPES, not one generic
// burst for everything. Uses canvas-confetti's real shapeFromText() (real
// emoji-rendered particle shapes, not a fake/simulated effect) so a savings
// milestone genuinely looks different from a streak or a health-score
// milestone, not just a colour swap.
// ---------------------------------------------------------------------------

let coinShape: confetti.Shape | null = null
let flameShape: confetti.Shape | null = null
let starShape: confetti.Shape | null = null

function getShape(cache: 'coin' | 'flame' | 'star'): confetti.Shape {
  if (cache === 'coin') return (coinShape ??= confetti.shapeFromText({ text: '🪙', scalar: 3 }))
  if (cache === 'flame') return (flameShape ??= confetti.shapeFromText({ text: '🔥', scalar: 3 }))
  return (starShape ??= confetti.shapeFromText({ text: '⭐', scalar: 3 }))
}

/** Savings goal fully funded / logged — coin shapes. */
export function fireSavingsConfetti() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  confetti({ particleCount: 30, spread: 70, origin: { y: 0.6 }, shapes: [getShape('coin')], scalar: 1 })
}

/** Streak milestone (7/30/100 days) — flame shapes. */
export function fireStreakConfetti() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  confetti({ particleCount: 30, spread: 80, origin: { y: 0.5 }, shapes: [getShape('flame')], scalar: 1, startVelocity: 40 })
}

/** Financial health score crossing into "healthy" territory — star shapes. */
export function fireHealthScoreConfetti() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  confetti({ particleCount: 40, spread: 100, origin: { y: 0.4 }, shapes: [getShape('star')], scalar: 1 })
}
