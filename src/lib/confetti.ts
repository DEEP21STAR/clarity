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
