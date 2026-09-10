import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const PARTICLE_COUNT = 400

/**
 * Slow-drifting particle field behind the whole app — Three.js, the same
 * technical family already proven in this codebase's earlier fridge work.
 * Deliberately subtle and GPU-cheap: a few hundred additive points, no
 * post-processing. Mouse-reactive spotlight glow + scroll parallax (this
 * background layer moves slower than the foreground content).
 */
export function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

    // Particle field
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    const palette = [
      new THREE.Color('#22d3ee'),
      new THREE.Color('#a855f7'),
      new THREE.Color('#ec4899'),
    ]
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20
      const c = palette[i % palette.length]
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
    const animate = () => {
      points.rotation.y += 0.0006
      points.rotation.x += 0.0002
      // Parallax: background drifts slower than the page scroll.
      points.position.y = scrollY * 0.0015
      spotlight.position.x = mouseX * 6
      spotlight.position.y = -mouseY * 4
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
