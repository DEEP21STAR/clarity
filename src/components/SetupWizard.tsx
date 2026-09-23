import { useEffect, useMemo, useState } from 'react'
import { SegmentedControl } from './SegmentedControl'
import { cn, formatCurrency } from '@/lib/utils'
import type { Country } from '@/lib/types'
import { Check, ChevronRight, ChevronLeft, Building2, Wallet, Sparkles } from 'lucide-react'

/**
 * Standalone onboarding wizard demo — reachable via ?wizard=demo, entirely bypasses PinGate
 * and AppContent so it never touches Deep's real data. Writes to its own isolated
 * localStorage key (WIZARD_DEMO_KEY), completely separate from the real app's
 * 'clarity-dashboard-state-v5' — this is a test/preview surface for what the eventual
 * client-onboarding flow will feel like (see project memory: business model is free +
 * donation-supported, this wizard is what a new client would walk through), not a way to
 * reconfigure Deep's own live household data.
 */

const WIZARD_DEMO_KEY = 'clarity-wizard-demo-v1'

const NZ_BANKS = ['ANZ', 'ASB', 'BNZ', 'Kiwibank', 'Westpac', 'Co-operative Bank']
const AU_BANKS = ['CommBank', 'Westpac', 'NAB', 'ANZ', 'ING', 'Macquarie', 'Bendigo']

interface WizardConfig {
  primaryName: string
  secondaryName: string
  country: Country
  bank: string
  monthlyIncome: number
  createdAt: string
}

function loadDemoConfig(): WizardConfig | null {
  try {
    const raw = localStorage.getItem(WIZARD_DEMO_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveDemoConfig(cfg: WizardConfig) {
  try {
    localStorage.setItem(WIZARD_DEMO_KEY, JSON.stringify(cfg))
  } catch {
    // Private browsing / storage blocked — wizard still works for the session, just won't persist.
  }
}

function clearDemoConfig() {
  try {
    localStorage.removeItem(WIZARD_DEMO_KEY)
  } catch { /* noop */ }
}

const STEP_LABELS = ['Identity', 'Country & Bank', 'Income', 'Ready']

export function SetupWizard() {
  const [step, setStep] = useState(0)
  const [primaryName, setPrimaryName] = useState('')
  const [secondaryName, setSecondaryName] = useState('')
  const [country, setCountry] = useState<Country>('NZ')
  const [bank, setBank] = useState('')
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [completed, setCompleted] = useState<WizardConfig | null>(null)

  useEffect(() => {
    const existing = loadDemoConfig()
    if (existing) setCompleted(existing)
  }, [])

  const banks = country === 'NZ' ? NZ_BANKS : AU_BANKS

  const canAdvance = useMemo(() => {
    if (step === 0) return primaryName.trim().length > 0
    if (step === 1) return bank.length > 0
    if (step === 2) return monthlyIncome > 0
    return true
  }, [step, primaryName, bank, monthlyIncome])

  const finish = () => {
    const cfg: WizardConfig = {
      primaryName: primaryName.trim(),
      secondaryName: secondaryName.trim(),
      country,
      bank,
      monthlyIncome,
      createdAt: new Date().toISOString(),
    }
    saveDemoConfig(cfg)
    setCompleted(cfg)
  }

  const restart = () => {
    clearDemoConfig()
    setCompleted(null)
    setStep(0)
    setPrimaryName('')
    setSecondaryName('')
    setCountry('NZ')
    setBank('')
    setMonthlyIncome(0)
  }

  // Same "safe to spend today" framing as the real Upcoming Payments hero — a believable
  // payoff moment right after setup, not just a blank dashboard.
  const weeklyPreview = completed ? completed.monthlyIncome / 4.33 : 0

  return (
    <div className="min-h-screen bg-[#05060a] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-500" />
          <span className="gradient-heading font-bold text-lg tracking-tight">Clarity</span>
          <span className="text-[10px] uppercase tracking-wider text-white/30 border border-white/10 rounded-full px-2 py-0.5 ml-1">
            Wizard preview
          </span>
        </div>

        {!completed ? (
          <div className="rounded-2xl border border-white/10 bg-[#0b0d14] p-6">
            {/* Step progress */}
            <div className="flex items-center gap-1.5 mb-6">
              {STEP_LABELS.map((label, i) => (
                <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      'h-1 w-full rounded-full transition-colors',
                      i <= step ? 'bg-gradient-to-r from-cyan-400 to-purple-500' : 'bg-white/10'
                    )}
                  />
                  <span className={cn('text-[9px]', i === step ? 'text-white/70' : 'text-white/25')}>{label}</span>
                </div>
              ))}
            </div>

            {step === 0 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold">Who's this for?</h2>
                <p className="text-xs text-white/40">Just a name — you can add a second person for a shared household, or leave it blank for a single view.</p>
                <div>
                  <label className="text-xs text-white/50">Your name</label>
                  <input
                    value={primaryName}
                    onChange={(e) => setPrimaryName(e.target.value)}
                    placeholder="e.g. Deep"
                    className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50">Add a second person (optional)</label>
                  <input
                    value={secondaryName}
                    onChange={(e) => setSecondaryName(e.target.value)}
                    placeholder="e.g. Mimi"
                    className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold">Where do you bank?</h2>
                <p className="text-xs text-white/40">Picking your bank lines up the right CSV format for statement imports later — no login, ever, just a file you export yourself.</p>
                <SegmentedControl
                  value={country}
                  onChange={(v) => { setCountry(v); setBank('') }}
                  options={[
                    { value: 'NZ', label: '🇳🇿 New Zealand' },
                    { value: 'AU', label: '🇦🇺 Australia' },
                  ]}
                />
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {banks.map((b) => (
                    <button
                      key={b}
                      onClick={() => setBank(b)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium text-left transition-colors',
                        bank === b
                          ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-200'
                          : 'border-white/10 text-white/60 hover:border-white/25'
                      )}
                    >
                      <Building2 className="w-3.5 h-3.5 shrink-0 opacity-60" />
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold">What's coming in?</h2>
                <p className="text-xs text-white/40">A rough monthly income figure — you can refine bills and categories once you're in.</p>
                <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 focus-within:border-cyan-400/50">
                  <span className="text-white/40">$</span>
                  <input
                    type="number"
                    value={monthlyIncome || ''}
                    onChange={(e) => setMonthlyIncome(parseFloat(e.target.value) || 0)}
                    placeholder="Monthly income"
                    className="w-full bg-transparent outline-none tabular-nums text-sm"
                  />
                  <span className="text-white/30 text-xs">/month</span>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold">Ready to go</h2>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-white/40">Set up for</span><span className="font-medium">{primaryName}{secondaryName ? ` + ${secondaryName}` : ''}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Country</span><span className="font-medium">{country === 'NZ' ? '🇳🇿 New Zealand' : '🇦🇺 Australia'}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Bank</span><span className="font-medium">{bank}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Monthly income</span><span className="font-medium tabular-nums">{formatCurrency(monthlyIncome)}</span></div>
                </div>
                <p className="text-[11px] text-white/30">This preview writes only to its own storage — it will never touch your real Clarity data.</p>
              </div>
            )}

            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white disabled:opacity-0 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
              {step < 3 ? (
                <button
                  onClick={() => canAdvance && setStep((s) => s + 1)}
                  disabled={!canAdvance}
                  className={cn(
                    'flex items-center gap-1 text-sm font-semibold rounded-lg px-4 py-2 transition-colors',
                    canAdvance ? 'bg-gradient-to-r from-cyan-400 to-purple-500 text-black' : 'bg-white/5 text-white/20 cursor-not-allowed'
                  )}
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={finish}
                  className="flex items-center gap-1.5 text-sm font-semibold rounded-lg px-4 py-2 bg-gradient-to-r from-cyan-400 to-purple-500 text-black"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Finish setup
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-cyan-400/30 bg-[#0b0d14] p-6 text-center space-y-5">
            <div className="w-12 h-12 rounded-full bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center mx-auto">
              <Check className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold">
                {completed.primaryName}{completed.secondaryName ? ` + ${completed.secondaryName}` : ''}, you're set up
              </h2>
              <p className="text-xs text-white/40 mt-1">{completed.bank} · {completed.country === 'NZ' ? 'New Zealand' : 'Australia'}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-5">
              <div className="text-[10px] uppercase tracking-wider text-white/40 flex items-center justify-center gap-1.5">
                <Wallet className="w-3 h-3" /> Rough weekly safe-to-spend
              </div>
              <div className="text-3xl font-bold tabular-nums mt-1 bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent">
                {formatCurrency(weeklyPreview)}
              </div>
              <p className="text-[10px] text-white/30 mt-1">Based on income only — add bills once you're in for the real number.</p>
            </div>
            <button
              onClick={restart}
              className="text-xs text-white/40 hover:text-white transition-colors"
            >
              Start over
            </button>
          </div>
        )}

        <p className="text-center text-[10px] text-white/25 mt-6">
          Preview mode — your real Clarity data is completely separate and untouched.
        </p>
      </div>
    </div>
  )
}
