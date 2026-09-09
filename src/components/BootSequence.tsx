import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

/** Brief GSAP boot sequence shown once per session — the app's cinematic "wake up" moment. */
export function BootSequence({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        setVisible(false)
        onDone()
      },
    })
    tl.fromTo('.boot-line', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.12 })
    tl.to('.boot-line', { opacity: 0, duration: 0.3, delay: 0.35 })
    tl.to(ref.current, { opacity: 0, duration: 0.4, onComplete: () => setVisible(false) })
    return () => { tl.kill() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!visible) return null
  return (
    <div ref={ref} className="fixed inset-0 z-50 flex items-center justify-center bg-[#05060a]">
      <div className="text-center font-mono">
        <div className="boot-line text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300">
          CLARITY
        </div>
        <div className="boot-line text-xs text-white/40 mt-2 tracking-[0.3em]">BUDGET SYSTEM — INITIALISING</div>
        <div className="boot-line text-[10px] text-cyan-300/60 mt-4">loading tax engine · payday model · insights</div>
      </div>
    </div>
  )
}
