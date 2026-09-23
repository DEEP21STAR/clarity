import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { CLARITY_PIN } from '@/lib/constants'
import { Lock } from 'lucide-react'
import { useStore } from '@/lib/store'
import { AmbientBackground } from './AmbientBackground'

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
  const { state } = useStore()
  const [unlocked, setUnlocked] = useState(isUnlocked)
  const [digits, setDigits] = useState('')
  const [error, setError] = useState(false)
  const gateRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!gateRef.current) return
    gsap.fromTo(gateRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5 })
  }, [])

  // "proceed with all" — AI GURU-inspired visual pass: extends the wizard's own neon-frame +
  // ambient-background treatment to this screen (the other full-screen moment every returning
  // session sees), instead of leaving it flat while the wizard got the uplift. Sets the theme
  // attribute here too — PinGate renders BEFORE AppContent (which normally owns this effect),
  // so without this, a chosen accent theme wouldn't take effect until AFTER unlocking.
  useEffect(() => {
    document.documentElement.dataset.accentTheme = state.accentTheme
  }, [state.accentTheme])

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
    <div ref={gateRef} className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05060a] overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <AmbientBackground />
      </div>
      <div className="wizard-neon-frame text-center px-6 py-8 rounded-3xl border-2 bg-[#0b0d14]/90">
        <div
          className="w-14 h-14 mx-auto rounded-2xl border flex items-center justify-center mb-6"
          style={{ background: 'linear-gradient(135deg, color-mix(in oklab, var(--theme-1) 20%, transparent), color-mix(in oklab, var(--theme-2) 20%, transparent))', borderColor: 'color-mix(in oklab, var(--theme-1) 30%, transparent)' }}
        >
          <Lock className="w-6 h-6" style={{ color: 'var(--theme-1)' }} />
        </div>
        <h1 className="gradient-heading text-xl font-bold tracking-tight mb-1">Clarity</h1>
        <p className="text-xs text-white/40 mb-6">Enter your PIN</p>

        <div className={`pin-dots flex justify-center gap-3 mb-8 ${error ? 'text-rose-400' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${error ? 'bg-rose-400 border-rose-400' : i < digits.length ? 'border-transparent' : 'border-white/20'}`}
              style={!error && i < digits.length ? { background: 'var(--theme-1)', borderColor: 'var(--theme-1)' } : undefined}
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
      className="pin-numbtn w-16 h-16 rounded-2xl border border-white/10 text-xl font-semibold text-white hover:bg-white/5"
      style={{ fontSize: 20 }} // >=16px avoids iOS Safari auto-zoom-on-focus
    >
      {label}
    </button>
  )
}
