import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

interface Particle {
  x: number
  y: number
  tx: number
  ty: number
  sx: number
  sy: number
  size: number
  hue: number
}

/**
 * 2026-09-23 — "maybe a cinematic intro... maybe the dollar sign" (Deep). Real particle-text
 * formation: samples the actual rendered glyph of "$" off an offscreen canvas (Canvas API text
 * rendering, not hand-plotted curve points — this is why the shape reads correctly at any
 * font/weight rather than an approximated symbol), scatters particles at random start
 * positions, converges them onto those sampled points, holds with a glow pulse, disperses, then
 * reveals the existing CLARITY wordmark + subtitle lines unchanged.
 *
 * Plain 2D canvas + a lightweight custom rAF loop, deliberately NOT the app's existing Three.js
 * AmbientBackground (src/components/AmbientBackground.tsx) — that's a persistent whole-app
 * WebGL scene; spinning up a second WebGL context for a ~2.5s one-shot that unmounts almost
 * immediately is wasted GPU setup/teardown for no visual benefit a 2D canvas doesn't already give
 * for a flat particle-text effect like this.
 */
function sampleDollarSignPoints(width: number, height: number, count: number): { x: number; y: number }[] {
  const off = document.createElement('canvas')
  off.width = width
  off.height = height
  const octx = off.getContext('2d')
  if (!octx) return []
  octx.fillStyle = '#fff'
  octx.textAlign = 'center'
  octx.textBaseline = 'middle'
  octx.font = `900 ${Math.round(height * 0.62)}px system-ui, sans-serif`
  octx.fillText('$', width / 2, height / 2 + height * 0.02)
  const { data } = octx.getImageData(0, 0, width, height)
  const candidates: { x: number; y: number }[] = []
  const step = 3
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3] > 120) candidates.push({ x, y })
    }
  }
  // Evenly subsample down to `count` points rather than every glyph pixel — keeps particle
  // count bounded regardless of screen size.
  const points: { x: number; y: number }[] = []
  const strideF = Math.max(1, candidates.length / count)
  for (let i = 0; i < candidates.length; i += strideF) points.push(candidates[Math.floor(i)])
  return points
}

export function BootSequence({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(true)
  const progressRef = useRef({ t: 0 }) // 0 = scattered, 1 = fully formed

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof window === 'undefined') return
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = window.innerWidth
    const h = window.innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    // Reduced-motion / low-power fallback: skip straight to the static formed glyph, no
    // scatter-converge animation, same as the old version's respect for this preference.
    if (reduceMotion) {
      progressRef.current.t = 1
    }

    const glyphBoxSize = Math.min(w, h) * 0.5
    const glyphOffsetX = w / 2 - glyphBoxSize / 2
    const glyphOffsetY = h / 2 - glyphBoxSize / 2 - h * 0.08
    const targets = sampleDollarSignPoints(glyphBoxSize, glyphBoxSize, 260)

    const particles: Particle[] = targets.map((t) => ({
      x: 0,
      y: 0,
      tx: t.x + glyphOffsetX,
      ty: t.y + glyphOffsetY,
      sx: Math.random() * w,
      sy: Math.random() * h,
      size: 1.2 + Math.random() * 1.6,
      hue: Math.random() < 0.5 ? 190 : 280, // cyan/purple mix, matches the app's own palette
    }))

    let raf = 0
    const draw = () => {
      // Explicitly opaque fill, not clearRect — the canvas doesn't rely on the parent div's
      // own dark background showing through its transparent pixels (confirmed via computed
      // styles that the parent IS opaque and covering; painting the canvas itself opaque too
      // removes that indirection so there's no dependency on canvas-transparency-over-opaque-
      // parent compositing behaving identically across every browser/rendering path).
      ctx.fillStyle = '#05060a'
      ctx.fillRect(0, 0, w, h)
      const t = progressRef.current.t
      // Ease the convergence (cubic ease-out) so particles decelerate into place rather than
      // arriving linearly — reads as "settling," not sliding.
      const eased = 1 - Math.pow(1 - t, 3)
      for (const p of particles) {
        p.x = p.sx + (p.tx - p.sx) * eased
        p.y = p.sy + (p.ty - p.sy) * eased
        const glow = 0.4 + eased * 0.6
        ctx.beginPath()
        ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${glow})`
        ctx.shadowColor = `hsla(${p.hue}, 90%, 65%, ${glow})`
        ctx.shadowBlur = 6 + eased * 4
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    const tl = gsap.timeline({
      onComplete: () => {
        cancelAnimationFrame(raf)
        setVisible(false)
        onDone()
      },
    })
    if (!reduceMotion) {
      tl.to(progressRef.current, { t: 1, duration: 1.1, ease: 'power3.out' })
      tl.to({}, { duration: 0.5 }) // hold, fully formed
    }
    tl.fromTo('.boot-line', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.12 })
    tl.to('.boot-line', { opacity: 0, duration: 0.3, delay: 0.35 })
    tl.to(canvas, { opacity: 0, duration: 0.35 }, '<')
    tl.to(ref.current, { opacity: 0, duration: 0.4, onComplete: () => setVisible(false) })

    return () => {
      tl.kill()
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const skip = () => {
    gsap.killTweensOf(progressRef.current)
    gsap.killTweensOf('.boot-line')
    gsap.killTweensOf(ref.current)
    gsap.killTweensOf(canvasRef.current)
    setVisible(false)
    onDone()
  }

  if (!visible) return null
  return (
    // 2026-09-23 — real bug found while verifying this: PinGate.tsx's own overlay is z-[100],
    // above this component's old z-50, meaning PinGate has always painted on TOP of the boot
    // sequence (confirmed via computed styles + a Playwright screenshot showing the PIN
    // keypad visible right through the "opaque" boot overlay). z-[110] guarantees this always
    // wins regardless of what PinGate's own z-index is or becomes later.
    <div ref={ref} className="fixed inset-0 z-[110] flex items-center justify-center bg-[#05060a] cursor-pointer overflow-hidden" onClick={skip}>
      <canvas ref={canvasRef} className="absolute inset-0" style={{ width: '100vw', height: '100vh' }} />
      <div className="text-center font-mono relative z-10 mt-[22vh]">
        <div className="boot-line text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300">
          CLARITY
        </div>
        <div className="boot-line text-xs text-white/40 mt-2 tracking-[0.3em]">BUDGET SYSTEM — INITIALISING</div>
        <div className="boot-line text-[10px] text-cyan-300/60 mt-4">loading tax engine · payday model · insights</div>
        <div className="boot-line text-[10px] text-white/25 mt-6">tap anywhere to skip</div>
      </div>
    </div>
  )
}
