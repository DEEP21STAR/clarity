import { Wallet, CalendarClock, TrendingUp, ShieldCheck } from 'lucide-react'

/**
 * 2026-09-23 round 5 — "no introduction of why we're doing this... it's just dumped on
 * straight away" (Deep). The wizard used to be reachable only via a hidden ?wizard=demo URL,
 * completely disconnected from the real app's first load. This is the missing beat: a real
 * first-run user now sees Boot -> Welcome (this) -> Wizard -> Dashboard, in that order, instead
 * of landing straight on an empty/seeded dashboard with no explanation. Existing accounts
 * (including Deep's own) never see this -- gated in App.tsx purely on whether this browser has
 * ever had real app data at all.
 */
const POINTS = [
  { icon: Wallet, text: 'One real number: what you can actually spend right now, after every bill.' },
  { icon: CalendarClock, text: 'Every upcoming payment, mapped to your real pay cycle — not a generic budget template.' },
  { icon: TrendingUp, text: 'Net worth, savings goals and spending streaks, updated automatically as you go.' },
  { icon: ShieldCheck, text: 'Everything stays on this device. No bank login, no account, nothing sent anywhere.' },
]

export function Welcome({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="min-h-screen bg-[#05060a] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-500" />
          <span className="gradient-heading font-bold text-lg tracking-tight">Clarity</span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300">
          Know what's actually free to spend.
        </h1>
        <p className="mt-3 text-sm text-white/50 leading-relaxed">
          A two-minute setup — your name, bank, pay cycle and bills — and Clarity does the rest.
        </p>

        <div className="mt-8 space-y-3 text-left">
          {POINTS.map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#0b0d14] px-4 py-3">
              <Icon className="w-4 h-4 shrink-0 mt-0.5 text-cyan-300" />
              <span className="text-xs text-white/70 leading-relaxed">{text}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="mt-8 w-full rounded-lg px-4 py-3 text-sm font-semibold bg-gradient-to-r from-cyan-400 to-purple-500 text-black hover:opacity-90 transition-opacity"
        >
          Get started
        </button>
        <p className="mt-3 text-[10px] text-white/25">Takes about 2 minutes</p>
      </div>
    </div>
  )
}
