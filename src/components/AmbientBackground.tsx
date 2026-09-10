import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const PARTICLE_COUNT = 400
const CALM_PALETTE = [new THREE.Color('#22d3ee'), new THREE.Color('#a855f7'), new THREE.Color('#34d399')]
const TROUBLED_PALETTE = [new THREE.Color('#ff2d55'), new THREE.Color('#f59e0b'), new THREE.Color('#ec4899')]

/**
 * Slow-drifting particle field behind the whole app — Three.js, the same
 * technical family already proven in this codebase's earlier fridge work.
 * Deliberately subtle and GPU-cheap: a few hundred additive points, no
 * post-processing. Mouse-reactive spotlight glow + scroll parallax (this
 * background layer moves slower than the foreground content).
 *
 * #22, Round 20: the field now reacts to the REAL current financial health
 * score (`computeCurrentHealthScore()` in logic.ts, the same formula the
 * Dashboard headline and daily snapshot use) — calmer/slower and cyan/purple
 * when healthy, more turbulent and red/amber-tinted when in trouble. `score`
 * is read via a ref so the animation loop (started once) always uses the
 * latest value without re-creating the whole Three.js scene on every score
 * change.
 */
export function AmbientBackground({ healthScore = 70 }: { healthScore?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scoreRef = useRef(healthScore)
  scoreRef.current = healthScore

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.z = 12

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(window.innerWidth, window.innerHeight)

    // Particle field — base positions + a per-particle random phase/speed for the
    // health-reactive "turbulence" jitter (troubled state), applied additively in animate().
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const basePositions = new Float32Array(PARTICLE_COUNT * 3)
    const phases = new Float32Array(PARTICLE_COUNT)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = (Math.random() - 0.5) * 30
      const y = (Math.random() - 0.5) * 20
      const z = (Math.random() - 0.5) * 20
      positions[i * 3] = basePositions[i * 3] = x
      positions[i * 3 + 1] = basePositions[i * 3 + 1] = y
      positions[i * 3 + 2] = basePositions[i * 3 + 2] = z
      phases[i] = Math.random() * Math.PI * 2
      const c = CALM_PALETTE[i % CALM_PALETTE.length]
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const material = new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    const points = new THREE.Points(geometry, material)
    scene.add(points)

    // Mouse-reactive spotlight
    const spotlight = new THREE.PointLight('#22d3ee', 4, 20)
    spotlight.position.set(0, 0, 5)
    scene.add(spotlight)

    let mouseX = 0
    let mouseY = 0
    let scrollY = 0
    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2
    }
    const onScroll = () => { scrollY = window.scrollY }
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)

    let raf = 0
    let t = 0
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute
    const lerpColor = new THREE.Color()
    const animate = () => {
      t += 1
      // 0 (healthy) -> 1 (troubled). Score >=75 is fully calm, <40 is fully troubled — matches
      // the mood-icon thresholds already used for the Dashboard's sunny/cloudy/stormy icon.
      const troubled = Math.max(0, Math.min(1, (75 - scoreRef.current) / 35))
      const speed = 0.0006 + troubled * 0.0018 // faster rotation the more troubled
      points.rotation.y += speed
      points.rotation.x += speed * 0.33
      points.position.y = scrollY * 0.0015
      spotlight.position.x = mouseX * 6
      spotlight.position.y = -mouseY * 4
      spotlight.color.set(troubled > 0.5 ? '#ff2d55' : '#22d3ee')

      // Turbulence jitter + colour blend — always recomputed (400 points is cheap) so a
      // score that improves back to calm genuinely resets position/colour rather than
      // freezing at whatever the last troubled frame happened to look like.
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const jitter = Math.sin(t * 0.02 + phases[i]) * troubled * 0.6
        posAttr.setX(i, basePositions[i * 3] + jitter)
        posAttr.setY(i, basePositions[i * 3 + 1] + jitter * 0.7)
        const calm = CALM_PALETTE[i % CALM_PALETTE.length]
        const bad = TROUBLED_PALETTE[i % TROUBLED_PALETTE.length]
        lerpColor.copy(calm).lerp(bad, troubled)
        colorAttr.setXYZ(i, lerpColor.r, lerpColor.g, lerpColor.b)
      }
      posAttr.needsUpdate = true
      colorAttr.needsUpdate = true

      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  )
}
