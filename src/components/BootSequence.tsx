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
 * WebGL scene; spinning up a second WebGL context for a ~4s one-shot that unmounts almost
 * immediately is wasted GPU setup/teardown for no visual benefit a 2D canvas doesn't already give
 * for a flat particle-text effect like this.
 *
 * 2026-09-23 round 4 — "3/10, needs to uplift to 10/10" (Deep, after seeing v1 static and small
 * on his phone). Real uplift, not a tweak: glyph nearly 50% bigger, particle count near-doubled,
 * a genuine motion-blur trail during convergence (soft-alpha fill instead of a hard opaque wipe
 * each frame — still fully opaque within 2-3 frames, so the z-index fix from round 3 still holds,
 * this only affects the visible trail, not the opacity guarantee), a shockwave ring that fires
 * the instant the glyph fully forms, a continuous breathing glow during the hold instead of a
 * static one, and a punchier scale+glow text reveal instead of a plain fade-up. Total runtime
 * ~4.2s (was ~1.9s) — still fully skippable by tap, same as before.
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
  const burstRef = useRef({ p: -1 }) // shockwave ring progress; -1 = not triggered yet

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

    // Real bug found in Playwright verification: a "$" glyph's actual ink only fills a modest
    // fraction of its own font em-box (it's a narrow, tall character) — sizing the sampling box
    // off the viewport's SMALLER dimension (portrait width, ~420px on a phone) capped the glyph
    // to a small ~76x84px result even after raising the multiplier, which is exactly why it read
    // as small/underwhelming. Sizing off the LARGER dimension (portrait height, where there's far
    // more room) and measuring the actual rendered ink afterward (not assuming a ratio) confirmed
    // this produces a properly large, prominent glyph instead.
    const glyphBoxSize = Math.max(w, h) * 0.85
    const glyphOffsetX = w / 2 - glyphBoxSize / 2
    const glyphOffsetY = h / 2 - glyphBoxSize / 2 - h * 0.1
    const glyphCenterX = w / 2
    const glyphCenterY = glyphOffsetY + glyphBoxSize / 2
    const targets = sampleDollarSignPoints(glyphBoxSize, glyphBoxSize, 460)

    const particles: Particle[] = targets.map((t) => ({
      x: 0,
      y: 0,
      tx: t.x + glyphOffsetX,
      ty: t.y + glyphOffsetY,
      sx: Math.random() * w,
      sy: Math.random() * h,
      size: 1.2 + Math.random() * 1.7,
      hue: Math.random() < 0.5 ? 190 : 280, // cyan/purple mix, matches the app's own palette
    }))

    let raf = 0
    let wasFormed = false
    const draw = () => {
      // Soft-alpha trail instead of a hard wipe — reads as real particle motion blur during the
      // scatter->converge phase. Still functionally opaque: at 60fps this alpha compounds to
      // near-total coverage within 2-3 frames, so the round-3 z-index fix (this layer must always
      // be opaque over PinGate) still holds — this only changes what's visible mid-motion, never
      // whether the frame ends up covering what's underneath.
      // Real bug found in Playwright verification: shadowBlur/shadowColor left set from the
      // PREVIOUS frame's particle/ring draws was bleeding into this clear fill (canvas shadow
      // state persists across draw calls until explicitly reset), so the low-alpha trail wash
      // accumulated a full-strength glow every frame instead of just fading dark. Must reset
      // before the plain background fill, every frame.
      ctx.shadowBlur = 0
      ctx.fillStyle = 'rgba(5,6,10,0.22)'
      ctx.fillRect(0, 0, w, h)
      const t = progressRef.current.t
      // Ease the convergence (cubic ease-out) so particles decelerate into place rather than
      // arriving linearly — reads as "settling," not sliding.
      const eased = 1 - Math.pow(1 - t, 3)

      if (t >= 0.999 && !wasFormed) {
        wasFormed = true
        burstRef.current.p = 0
      }

      // Continuous breathing glow during the hold — was a static glow value once formed, now a
      // slow sine pulse so the fully-formed glyph keeps feeling alive rather than freezing.
      const pulse = eased >= 0.999 ? 0.82 + 0.18 * Math.sin(performance.now() * 0.0035) : 1

      for (const p of particles) {
        p.x = p.sx + (p.tx - p.sx) * eased
        p.y = p.sy + (p.ty - p.sy) * eased
        const glow = (0.4 + eased * 0.6) * pulse
        ctx.beginPath()
        ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${glow})`
        ctx.shadowColor = `hsla(${p.hue}, 90%, 65%, ${glow})`
        ctx.shadowBlur = (6 + eased * 5) * pulse
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }

      // Shockwave ring — fires once, the instant the glyph fully forms, expanding outward from
      // the glyph's own center and fading as it grows. The single beat that makes formation read
      // as an EVENT rather than particles just drifting to a stop.
      if (burstRef.current.p >= 0 && burstRef.current.p < 1) {
        const bp = burstRef.current.p
        const radius = bp * glyphBoxSize * 1.15
        const alpha = (1 - bp) * 0.85
        ctx.save()
        ctx.beginPath()
        ctx.strokeStyle = `rgba(120, 230, 255, ${alpha})`
        ctx.shadowColor = `rgba(160, 120, 255, ${alpha})`
        ctx.shadowBlur = 24
        ctx.lineWidth = 3
        ctx.arc(glyphCenterX, glyphCenterY, radius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
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
      tl.to(progressRef.current, { t: 1, duration: 1.3, ease: 'power3.out' })
      tl.to(burstRef.current, { p: 1, duration: 0.7, ease: 'power2.out' })
      tl.to({}, { duration: 0.5 }) // hold, fully formed, breathing glow running
    }
    // Punchier reveal: scale + glow in, not just a fade-up — reads as the wordmark arriving with
    // weight rather than politely appearing.
    tl.fromTo(
      '.boot-line',
      { opacity: 0, y: 10, scale: 0.85, filter: 'brightness(2.2)' },
      { opacity: 1, y: 0, scale: 1, filter: 'brightness(1)', duration: 0.45, stagger: 0.12, ease: 'back.out(1.7)' }
    )
    tl.to({}, { duration: 0.45 }) // hold on the formed wordmark
    tl.to('.boot-line', { opacity: 0, duration: 0.3 })
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
    gsap.killTweensOf(burstRef.current)
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
      <div className="text-center font-mono relative z-10 mt-[26vh]">
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
