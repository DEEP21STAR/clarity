import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { CLARITY_PIN } from '@/lib/constants'
import { Lock } from 'lucide-react'

// ALWAYS sessionStorage, NEVER localStorage — iOS Safari kills localStorage
// in private browsing, per the same rule every other Whetū Digital dashboard
// uses (see the /clarity skill's ABSOLUTE RULES). A tab refresh within the
// same session stays unlocked; closing the tab re-locks it.
const SESSION_KEY = 'clarity-pin-unlocked'

function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

/** iOS-safe 4-digit PIN gate — dot indicators + numpad, matching the Whetū Digital dashboard standard. */
export function PinGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(isUnlocked)
  const [digits, setDigits] = useState('')
  const [error, setError] = useState(false)
  const gateRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!gateRef.current) return
    gsap.fromTo(gateRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5 })
  }, [])

  const pressKey = (d: string) => {
    if (digits.length >= 4) return
    const next = digits + d
    setDigits(next)
    if (next.length === 4) {
      if (next === CLARITY_PIN) {
        try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* ignore */ }
        setUnlocked(true)
      } else {
        setError(true)
        if (gateRef.current) {
          gsap.fromTo(gateRef.current.querySelector('.pin-dots'), { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' })
        }
        setTimeout(() => { setDigits(''); setError(false) }, 500)
      }
    }
  }

  const backspace = () => setDigits((d) => d.slice(0, -1))

  if (unlocked) return <>{children}</>

  return (
    <div ref={gateRef} className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05060a]">
      <div className="text-center px-6">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 border border-cyan-400/30 flex items-center justify-center mb-6">
          <Lock className="w-6 h-6 text-cyan-300" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight mb-1">Clarity</h1>
        <p className="text-xs text-white/40 mb-6">Enter your PIN</p>

        <div className={`pin-dots flex justify-center gap-3 mb-8 ${error ? 'text-rose-400' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                i < digits.length
                  ? error ? 'bg-rose-400 border-rose-400' : 'bg-cyan-400 border-cyan-400'
                  : 'border-white/20'
              }`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 max-w-[220px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
            <NumButton key={n} label={n} onClick={() => pressKey(n)} />
          ))}
          <div />
          <NumButton label="0" onClick={() => pressKey('0')} />
          <button
            onClick={backspace}
            aria-label="Backspace"
            className="w-16 h-16 rounded-2xl border border-white/10 text-white/50 hover:bg-white/5 flex items-center justify-center text-sm"
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  )
}

function NumButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-16 h-16 rounded-2xl border border-white/10 text-xl font-semibold text-white hover:bg-white/5 hover:border-cyan-400/40 active:scale-95 transition-all"
      style={{ fontSize: 20 }} // >=16px avoids iOS Safari auto-zoom-on-focus
    >
      {label}
    </button>
  )
}
