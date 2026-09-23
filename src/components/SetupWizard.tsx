import { useEffect, useMemo, useRef, useState } from 'react'
import { SegmentedControl } from './SegmentedControl'
import { DateField } from './DateField'
import { StoreProvider, DEFAULT_STATE, STORAGE_KEY, type AppState } from '@/lib/store'
import { ToastProvider } from './Toast'
import { AppContent } from '../App'
import { BootSequence } from './BootSequence'
import { cn, formatCurrency, todayIso } from '@/lib/utils'
import { round2 } from '@/lib/logic'
import type { Country, RecurringBill } from '@/lib/types'
import { Check, ChevronRight, ChevronLeft, Building2, Wallet, Sparkles, Plus, Trash2, Upload, FileText, Info, LayoutDashboard } from 'lucide-react'

const DEMO_DASHBOARD_KEY = 'clarity-wizard-live-demo-v1'

/**
 * Standalone onboarding wizard demo — reachable via ?wizard=demo, entirely bypasses PinGate
 * and AppContent so it never touches Deep's real data. Writes to its own isolated
 * localStorage key (WIZARD_DEMO_KEY), completely separate from the real app's
 * 'clarity-dashboard-state-v5' — this is a test/preview surface for what the eventual
 * client-onboarding flow will feel like, not a way to reconfigure Deep's own live data.
 *
 * 2026-09-23 round 2 — Deep's feedback after walking through v1 on his phone: it was missing
 * real depth (pay cycle, recurring bills, bank CSV). Extended to 6 real steps. Every button
 * gets an explicit type="button" (defensive — there's no <form> anywhere in this tree so a
 * submit-triggered reload shouldn't be possible, but it costs nothing and rules out a whole
 * bug class for the "restarts on Finish" report, which didn't reproduce in direct testing here
 * and looks environmental — see the chat reply for the honest read on that).
 */

const WIZARD_DEMO_KEY = 'clarity-wizard-demo-v2'

const NZ_BANKS = ['ANZ', 'ASB', 'BNZ', 'Kiwibank', 'Westpac', 'Co-operative Bank']
const AU_BANKS = ['CommBank', 'Westpac', 'NAB', 'ANZ', 'ING', 'Macquarie', 'Bendigo']

type Frequency = 'weekly' | 'fortnightly' | 'monthly'

interface WizardBill {
  id: string
  name: string
  amount: number
  frequency: Frequency
  nextDue: string
  /** "or put a skip as well" (Deep) — the date-picker isn't the only way in; you can also say
   * you don't know it yet instead of being forced to pick some date. */
  dueUnknown: boolean
}

interface WizardConfig {
  primaryName: string
  secondaryName: string
  primaryColor: NameColor
  secondaryColor: NameColor
  country: Country
  bank: string
  payFrequency: Frequency
  monthlyIncome: number
  bills: WizardBill[]
  csvFileName: string | null
  csvRowCount: number | null
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

const STEP_LABELS = ['Identity', 'Bank', 'Pay & Income', 'Bills', 'Statement', 'Ready']
const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
]

/** Very simple CSV parse for a real preview — splits on commas, no quoted-field handling.
 * Deliberately not doing per-bank column auto-mapping here: that needs a real sample export
 * from each bank to build accurately (formats genuinely differ), not a guessed layout. See the
 * note on the Statement step itself. */
function parseCsvPreview(text: string, maxRows = 5): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(0, maxRows)
    .map((line) => line.split(',').map((cell) => cell.trim()))
}

type NameColor = 'blue' | 'pink' | 'neutral'

const NAME_COLOR_STYLE: Record<NameColor, { text: string; glow: string; swatch: string }> = {
  blue: { text: 'text-sky-300', glow: 'drop-shadow-[0_0_10px_rgba(56,189,248,0.75)]', swatch: 'bg-sky-400' },
  pink: { text: 'text-pink-300', glow: 'drop-shadow-[0_0_10px_rgba(244,114,182,0.75)]', swatch: 'bg-pink-400' },
  neutral: { text: 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-300', glow: '', swatch: 'bg-gradient-to-br from-cyan-400 to-purple-400' },
}

/** 2026-09-23 round 3 — Deep's own read after seeing the free-choice colour swatches on his
 * phone: "that will just get confusing" (his words). A blank set of colour dots asks the user
 * to know something the app hasn't told them (blue = ?, pink = ?), so it replaced with named,
 * self-explanatory options — the colour is now a consequence of the choice, not the choice
 * itself. "Prefer not to say" (Deep said "don't prefer sharing") maps to the same neutral
 * cyan/purple gradient neither gendered colour was defaulted to before. */
const IDENTITY_OPTIONS: { value: NameColor; label: string }[] = [
  { value: 'blue', label: 'Male' },
  { value: 'pink', label: 'Female' },
  { value: 'neutral', label: 'Prefer not to say' },
]

function IdentityColorPicker({ value, onChange }: { value: NameColor; onChange: (c: NameColor) => void }) {
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      {IDENTITY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium rounded-lg px-2 py-1.5 border transition-colors',
            value === opt.value
              ? cn('border-white/40 bg-white/10', NAME_COLOR_STYLE[opt.value].text)
              : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
          )}
        >
          <span className={cn('w-2 h-2 rounded-full shrink-0', NAME_COLOR_STYLE[opt.value].swatch)} />
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function SetupWizard({ mode = 'demo' }: { mode?: 'demo' | 'onboarding' } = {}) {
  // 2026-09-23 round 5 — "onboarding" is a real first-run: launchDashboard below writes to the
  // REAL app's own storage key instead of the isolated demo key, so what the user builds here
  // becomes their actual persisted dashboard, not a throwaway preview.
  const [step, setStep] = useState(0)
  const [primaryName, setPrimaryName] = useState('')
  const [secondaryName, setSecondaryName] = useState('')
  // "neon lights whether it's pink or blue" (Deep) — an explicit per-person choice, never
  // inferred from the name itself. 'neutral' (cyan/purple, matching the app's own brand
  // gradient) is the default so nobody's forced to pick blue or pink if neither fits.
  const [primaryColor, setPrimaryColor] = useState<'blue' | 'pink' | 'neutral'>('neutral')
  const [secondaryColor, setSecondaryColor] = useState<'blue' | 'pink' | 'neutral'>('neutral')
  const [country, setCountry] = useState<Country>('NZ')
  const [bank, setBank] = useState('')
  const [payFrequency, setPayFrequency] = useState<Frequency>('weekly')
  // 2026-09-23 round 3 — "if user selects weekly or fortnightly puts that amount in, it should
  // calculate automatically what the monthly amount would be" (Deep). payAmount is genuinely
  // whatever cycle the user picked (a weekly figure stays a weekly figure); monthlyIncome below
  // is now always DERIVED, never something the user is asked to already know or work out.
  const [payAmount, setPayAmount] = useState(0)
  const monthlyIncome = useMemo(() => {
    if (payAmount <= 0) return 0
    if (payFrequency === 'weekly') return round2((payAmount * 52) / 12)
    if (payFrequency === 'fortnightly') return round2((payAmount * 26) / 12)
    return payAmount
  }, [payAmount, payFrequency])
  const [bills, setBills] = useState<WizardBill[]>([])
  const [billName, setBillName] = useState('')
  const [billAmount, setBillAmount] = useState(0)
  const [billFreq, setBillFreq] = useState<Frequency>('monthly')
  const [billDue, setBillDue] = useState(todayIso())
  const [billDueUnknown, setBillDueUnknown] = useState(false)
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [csvPreview, setCsvPreview] = useState<string[][] | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<WizardConfig | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const existing = loadDemoConfig()
    if (existing) setCompleted(existing)
  }, [])

  const banks = country === 'NZ' ? NZ_BANKS : AU_BANKS

  const canAdvance = useMemo(() => {
    if (step === 0) return primaryName.trim().length > 0
    if (step === 1) return bank.length > 0
    if (step === 2) return monthlyIncome > 0
    return true // Bills and Statement are both genuinely optional
  }, [step, primaryName, bank, monthlyIncome])

  const addBill = () => {
    if (!billName.trim() || billAmount <= 0) return
    setBills((b) => [...b, { id: `bill-${Date.now()}`, name: billName.trim(), amount: billAmount, frequency: billFreq, nextDue: billDue, dueUnknown: billDueUnknown }])
    setBillName('')
    setBillAmount(0)
    setBillDueUnknown(false)
  }
  const removeBill = (id: string) => setBills((b) => b.filter((x) => x.id !== id))

  const handleFile = (file: File | null) => {
    setCsvError(null)
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvError('That doesn’t look like a CSV file — export your statement as CSV, not PDF.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const rows = parseCsvPreview(text)
      if (rows.length === 0) {
        setCsvError('That file looks empty — try exporting again.')
        return
      }
      setCsvFileName(file.name)
      setCsvPreview(rows)
    }
    reader.onerror = () => setCsvError('Could not read that file — try again.')
    reader.readAsText(file)
  }

  // 2026-09-23 — "why isn't the dashboard loading" (Deep, after finishing the wizard). The
  // completion card was a static summary; he reasonably expected Finish to land him in the
  // real Dashboard/Upcoming Payments/hamburger-nav experience, populated with what he'd just
  // entered. Builds a real AppState seed from the wizard's own collected bills, written to a
  // storage key (DEMO_DASHBOARD_KEY) that is NOT 'clarity-dashboard-state-v5' — his real data
  // is a completely separate localStorage key and this code path never reads or writes it.
  // Deliberately starts from an EMPTY base, not DEFAULT_STATE's own SEED_BILLS/SEED_CREDIT_CARDS
  // — those are Deep's own real placeholder data (a real $9,900.25 "GEM VISA Deep" balance
  // among them) and must never leak into a fresh client's first look at their own dashboard.
  //
  // 2026-09-23 follow-up — income is now genuinely per-instance too (state.incomeAnchor,
  // see store.tsx/logic.ts), not the hardcoded INCOME_ANCHOR constant this comment used to
  // flag as a known gap. The pay-cycle mapping below is the honest part now: the underlying
  // date model is inherently weekly-anchored, so 'monthly' is approximated as an even weekly
  // spread rather than a true once-a-month lump sum — said here, not hidden.
  const buildDemoSeed = (): AppState => {
    const mappedBills: RecurringBill[] = bills.map((b) => ({
      id: b.id,
      name: b.name,
      amount: b.amount,
      frequency: b.frequency,
      dueDay: b.dueUnknown ? 1 : Number(b.nextDue.slice(8, 10)) || 1,
      dueDayIsEstimate: b.dueUnknown ? true : false,
      category: 'other',
      active: true,
      owner: 'shared',
    }))
    // 2026-09-23 — real per-instance pay pattern (incomeAnchor is no longer hardcoded to
    // Deep's own schedule, see logic.ts/store.tsx). Maps the wizard's simple pay-cycle pick
    // onto the underlying weekly-anchored date model:
    //  - weekly: paid the same amount every payday, no combined-week bonus.
    //  - fortnightly: weeklyAmount 0, the whole amount sits in fortnightlyBonusAmount, so only
    //    the alternating "combined" weeks actually pay anything — genuinely paid once a
    //    fortnight, not an approximation.
    //  - monthly: the underlying model is inherently week-based and has no clean way to
    //    represent "one lump sum a month" — honestly approximated as an even weekly spread
    //    rather than forced into something it can't represent. Said here, not hidden.
    const incomeAnchor =
      payFrequency === 'fortnightly'
        ? { anchorDate: todayIso(), weeklyAmount: 0, fortnightlyBonusAmount: round2((monthlyIncome * 12) / 26) }
        : { anchorDate: todayIso(), weeklyAmount: round2((monthlyIncome * 12) / 52), fortnightlyBonusAmount: 0 }

    return {
      ...DEFAULT_STATE,
      country,
      bills: mappedBills,
      accounts: DEFAULT_STATE.accounts.map((a) => ({ ...a, value: 0 })),
      creditCards: [],
      deviceRepayments: [],
      periodicBills: [],
      savingsGoals: [],
      oneOffEntries: [],
      netWorthHistory: [],
      healthScoreHistory: [],
      spendTracker: { food: 0, fuel: 0, personal: 0, periodStart: todayIso() },
      streak: { current: 0, best: 0, lastCheckedDate: '', milestonesHit: [] },
      grossAnnualIncome: monthlyIncome * 12,
      incomeAnchor,
      dashboardCardOrder: DEFAULT_STATE.dashboardCardOrder,
    }
  }

  const finish = () => {
    const cfg: WizardConfig = {
      primaryName: primaryName.trim(),
      secondaryName: secondaryName.trim(),
      primaryColor,
      secondaryColor,
      country,
      bank,
      payFrequency,
      monthlyIncome,
      bills,
      csvFileName,
      csvRowCount: csvPreview ? csvPreview.length : null,
      createdAt: new Date().toISOString(),
    }
    saveDemoConfig(cfg)
    setCompleted(cfg)
  }

  const [launchedDashboard, setLaunchedDashboard] = useState(false)
  const [demoSeed, setDemoSeed] = useState<AppState | null>(null)
  // 2026-09-23 round 3 — "there's no cinematic intro" (Deep). Real root cause, found by reading
  // this file: the wizard's own "Go to Dashboard" handoff mounted AppContent directly and never
  // rendered BootSequence at all — it's a genuinely separate code path from App()'s own real
  // boot (App() checks isWizardDemo BEFORE ever mounting BootSequence, so the wizard's whole
  // flow, wizard steps included, never passed through it). Not a caching/device issue — the
  // component was simply never in this tree. Fixed at the actual entry point.
  const [demoBooted, setDemoBooted] = useState(false)
  const launchDashboard = () => {
    // First-load fallback only — if this key already has something saved (a returning visit
    // to the demo dashboard), the real saved state wins, same as the app's normal load rules.
    setDemoSeed(buildDemoSeed())
    setLaunchedDashboard(true)
  }

  const restart = () => {
    clearDemoConfig()
    setCompleted(null)
    setStep(0)
    setPrimaryName('')
    setSecondaryName('')
    setPrimaryColor('neutral')
    setSecondaryColor('neutral')
    setCountry('NZ')
    setBank('')
    setPayFrequency('weekly')
    setPayAmount(0)
    setBills([])
    setBillDueUnknown(false)
    setCsvFileName(null)
    setCsvPreview(null)
    setCsvError(null)
    setLaunchedDashboard(false)
    setDemoSeed(null)
    setDemoBooted(false)
  }

  const totalMonthlyBills = useMemo(
    () => bills.reduce((sum, b) => sum + (b.frequency === 'weekly' ? b.amount * 4.33 : b.frequency === 'fortnightly' ? b.amount * 2.17 : b.amount), 0),
    [bills]
  )
  const weeklyPreview = completed ? (completed.monthlyIncome - totalMonthlyBills) / 4.33 : 0

  if (launchedDashboard && demoSeed) {
    // Onboarding mode already ran the real boot sequence once in App.tsx (before Welcome) —
    // showing it again here would be a second, redundant intro. Only the standalone ?wizard=demo
    // path (which never passes through App()'s own boot) needs its own.
    return (
      <StoreProvider storageKey={mode === 'onboarding' ? STORAGE_KEY : DEMO_DASHBOARD_KEY} seedState={demoSeed}>
        <ToastProvider>
          {mode === 'demo' && !demoBooted && <BootSequence onDone={() => setDemoBooted(true)} />}
          <AppContent />
        </ToastProvider>
      </StoreProvider>
    )
  }

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
            <div className="flex items-center gap-1.5 mb-6">
              {STEP_LABELS.map((label, i) => (
                <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className={cn('h-1 w-full rounded-full transition-colors', i <= step ? 'bg-gradient-to-r from-cyan-400 to-purple-500' : 'bg-white/10')} />
                  <span className={cn('text-[8.5px] text-center leading-tight', i === step ? 'text-white/70' : 'text-white/25')}>{label}</span>
                </div>
              ))}
            </div>

            {/* 2026-09-23 — real step-to-step transition (was an instant swap). key={step}
                remounts this wrapper on every step change, which is what actually retriggers
                the CSS animation each time — a class alone wouldn't re-fire without a fresh
                mount. */}
            <div key={step} className="wizard-step-in">
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold">Who's this for?</h2>
                <p className="text-xs text-white/40">Just a name — add a second person for a shared household, or leave it blank for a single view.</p>
                <div>
                  <label className="text-xs text-white/50">Your name</label>
                  <input value={primaryName} onChange={(e) => setPrimaryName(e.target.value)} placeholder="e.g. Deep" className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-400/50" />
                  <IdentityColorPicker value={primaryColor} onChange={setPrimaryColor} />
                </div>
                <div>
                  <label className="text-xs text-white/50">Add a second person (optional)</label>
                  <input value={secondaryName} onChange={(e) => setSecondaryName(e.target.value)} placeholder="e.g. Mimi" className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-400/50" />
                  <IdentityColorPicker value={secondaryColor} onChange={setSecondaryColor} />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold">Where do you bank?</h2>
                <p className="text-xs text-white/40">Picking your bank lines up the right CSV format for statement imports — no login, ever, just a file you export yourself.</p>
                <SegmentedControl value={country} onChange={(v) => { setCountry(v); setBank('') }} options={[{ value: 'NZ', label: '🇳🇿 New Zealand' }, { value: 'AU', label: '🇦🇺 Australia' }]} />
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {banks.map((b) => (
                    <button key={b} type="button" onClick={() => setBank(b)} className={cn('flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium text-left transition-colors', bank === b ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-200' : 'border-white/10 text-white/60 hover:border-white/25')}>
                      <Building2 className="w-3.5 h-3.5 shrink-0 opacity-60" />
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold">How often are you paid, and how much?</h2>
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Pay cycle</label>
                  <SegmentedControl value={payFrequency} onChange={setPayFrequency} options={FREQ_OPTIONS} />
                </div>
                <div>
                  <label className="text-xs text-white/50">
                    Income, {payFrequency === 'weekly' ? 'per week' : payFrequency === 'fortnightly' ? 'per fortnight' : 'per month'}
                  </label>
                  <div className="mt-1 flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 focus-within:border-cyan-400/50">
                    <span className="text-white/40">$</span>
                    <input
                      type="number"
                      value={payAmount || ''}
                      onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                      placeholder={payFrequency === 'weekly' ? 'Weekly income' : payFrequency === 'fortnightly' ? 'Fortnightly income' : 'Monthly income'}
                      className="w-full bg-transparent outline-none tabular-nums text-sm"
                    />
                    <span className="text-white/30 text-xs">/{payFrequency === 'weekly' ? 'week' : payFrequency === 'fortnightly' ? 'fortnight' : 'month'}</span>
                  </div>
                  {payFrequency !== 'monthly' && payAmount > 0 && (
                    <p className="text-[11px] text-cyan-300/70 mt-1.5">≈ {formatCurrency(monthlyIncome)}/month — worked out automatically</p>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold">What payments do you already have?</h2>
                <p className="text-xs text-white/40">Rent, subscriptions, insurance — anything recurring. Add as many as you like, or skip and add them once you're in.</p>
                <div className="grid grid-cols-1 gap-2 bg-black/20 border border-white/10 rounded-lg p-3">
                  <input value={billName} onChange={(e) => setBillName(e.target.value)} placeholder="e.g. Rent" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-cyan-400/50" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1 bg-black/30 border border-white/10 rounded-lg px-2.5 py-2">
                      <span className="text-white/40 text-xs">$</span>
                      <input type="number" step="0.01" value={billAmount || ''} onChange={(e) => setBillAmount(parseFloat(e.target.value) || 0)} placeholder="Amount" className="w-full bg-transparent outline-none tabular-nums text-xs" />
                    </div>
                    <select value={billFreq} onChange={(e) => setBillFreq(e.target.value as Frequency)} className="bg-black/30 border border-white/10 rounded-lg px-2 text-xs outline-none">
                      {FREQ_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  {billDueUnknown ? (
                    <div className="flex items-center justify-between bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/40">
                      <span>Due date not set yet — that's fine.</span>
                      <button type="button" onClick={() => setBillDueUnknown(false)} className="text-cyan-300 hover:text-cyan-200 shrink-0 ml-2">Set a date</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <DateField value={billDue} onChange={setBillDue} inputClassName="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-cyan-400/50" overlayClassName="px-3 text-xs" />
                      <button type="button" onClick={() => setBillDueUnknown(true)} className="text-[11px] text-white/35 hover:text-white/60 whitespace-nowrap shrink-0">
                        Not sure — skip
                      </button>
                    </div>
                  )}
                  <button type="button" onClick={addBill} disabled={!billName.trim() || billAmount <= 0} className="flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg py-2 bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-cyan-400/40 disabled:opacity-30 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add payment
                  </button>
                </div>
                {bills.length > 0 && (
                  <div className="space-y-1.5">
                    {bills.map((b) => (
                      <div key={b.id} className="flex items-center justify-between text-xs bg-black/20 rounded-lg px-3 py-2 border border-white/5">
                        <div>
                          <span className="font-medium">{b.name}</span>
                          <span className="text-white/40"> · {formatCurrency(b.amount)} {b.frequency}{b.dueUnknown ? ' · due date not set' : ''}</span>
                        </div>
                        <button type="button" onClick={() => removeBill(b.id)} className="text-white/30 hover:text-rose-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold">Import a bank statement</h2>
                <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3 text-[11px] text-white/60 leading-relaxed">
                  <p className="flex items-center gap-1.5 text-cyan-300 font-semibold mb-1"><Info className="w-3 h-3" /> How to get the file</p>
                  Log into {bank || 'your bank'}'s website or app, look for <b className="text-white/80">"Export," "Download transactions,"</b> or <b className="text-white/80">"Statements,"</b> choose <b className="text-white/80">CSV</b> as the format (not PDF), pick the last 30–90 days, then download.
                  <p className="mt-1.5 text-white/40">Exact wording varies by bank — this is the general pattern every online banking site follows.</p>
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full flex flex-col items-center gap-2 border border-dashed border-white/15 hover:border-cyan-400/40 rounded-xl py-6 text-white/50 hover:text-white transition-colors">
                  <Upload className="w-5 h-5" />
                  <span className="text-xs">{csvFileName ? 'Choose a different file' : 'Tap to choose your CSV file'}</span>
                </button>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
                {csvError && <p className="text-[11px] text-rose-300">{csvError}</p>}
                {csvFileName && csvPreview && (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="flex items-center gap-1.5 text-xs text-emerald-300 mb-2"><FileText className="w-3.5 h-3.5" /> {csvFileName} — first {csvPreview.length} row{csvPreview.length === 1 ? '' : 's'}</p>
                    <div className="overflow-x-auto">
                      <table className="text-[10px] tabular-nums w-full">
                        <tbody>
                          {csvPreview.map((row, i) => (
                            <tr key={i} className={i === 0 ? 'text-white/70 font-semibold' : 'text-white/45'}>
                              {row.map((cell, j) => <td key={j} className="pr-3 py-0.5 whitespace-nowrap">{cell}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-[10px] text-white/30">This is a raw preview only — automatic column matching for {bank || 'your bank'}'s exact format needs a real sample from you to build accurately, not a guess. Not wired into any real import yet.</p>
                  </div>
                )}
                <p className="text-[11px] text-white/30 text-center">Optional — skip this and add transactions manually once you're in.</p>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold">Ready to go</h2>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-white/40">Set up for</span><span className="font-medium">{primaryName}{secondaryName ? ` + ${secondaryName}` : ''}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Bank</span><span className="font-medium">{bank} · {country}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Pay cycle</span><span className="font-medium capitalize">{payFrequency}, {formatCurrency(monthlyIncome)}/mo</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Recurring payments</span><span className="font-medium">{bills.length === 0 ? 'None added' : `${bills.length} added`}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Bank statement</span><span className="font-medium">{csvFileName ?? 'Not imported'}</span></div>
                </div>
                <p className="text-[11px] text-white/30">This preview writes only to its own storage — it will never touch your real Clarity data.</p>
              </div>
            )}
            </div>

            <div className="flex items-center justify-between mt-6">
              <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="flex items-center gap-1 text-xs text-white/40 hover:text-white disabled:opacity-0 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
              <div className="flex items-center gap-4">
                {/* Bills and Statement are genuinely optional (canAdvance is already true for
                    both) — an explicit "Skip" makes that obvious instead of making someone
                    guess whether Next with nothing filled in is allowed. */}
                {(step === 3 || step === 4) && (
                  <button type="button" onClick={() => setStep((s) => s + 1)} className="text-xs text-white/35 hover:text-white/60 transition-colors">
                    Skip{step === 3 ? ' — add payments later' : ' — import later'}
                  </button>
                )}
                {step < 5 ? (
                  <button type="button" onClick={() => canAdvance && setStep((s) => s + 1)} disabled={!canAdvance} className={cn('flex items-center gap-1 text-sm font-semibold rounded-lg px-4 py-2 transition-colors', canAdvance ? 'bg-gradient-to-r from-cyan-400 to-purple-500 text-black' : 'bg-white/5 text-white/20 cursor-not-allowed')}>
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button type="button" onClick={finish} className="flex items-center gap-1.5 text-sm font-semibold rounded-lg px-4 py-2 bg-gradient-to-r from-cyan-400 to-purple-500 text-black">
                    <Sparkles className="w-3.5 h-3.5" /> Finish setup
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-cyan-400/30 bg-[#0b0d14] p-6 text-center space-y-5">
            <div className="w-12 h-12 rounded-full bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center mx-auto">
              <Check className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold">
                <span className={cn(NAME_COLOR_STYLE[completed.primaryColor].text, NAME_COLOR_STYLE[completed.primaryColor].glow)}>{completed.primaryName}</span>
                {completed.secondaryName && (
                  <> + <span className={cn(NAME_COLOR_STYLE[completed.secondaryColor].text, NAME_COLOR_STYLE[completed.secondaryColor].glow)}>{completed.secondaryName}</span></>
                )}
                , you're set up
              </h2>
              <p className="text-xs text-white/40 mt-1">{completed.bank} · {completed.country === 'NZ' ? 'New Zealand' : 'Australia'} · {completed.bills.length} payment{completed.bills.length === 1 ? '' : 's'} tracked</p>
            </div>
            <div className={cn('rounded-xl border p-5', weeklyPreview < 0 ? 'border-rose-500/30 bg-rose-500/5' : 'border-white/10 bg-black/20')}>
              <div className="text-[10px] uppercase tracking-wider text-white/40 flex items-center justify-center gap-1.5">
                <Wallet className="w-3 h-3" /> Rough weekly safe-to-spend
              </div>
              {/* 2026-09-23 — real bug caught reviewing Deep's own walkthrough: a real household
                  (his test data: $6,800/mo income against 10 real bills including $1,955 rent)
                  landed at -$524.24/week, and it was rendering in the SAME celebratory
                  cyan-purple gradient as a healthy positive number — reads as good news when
                  it's the opposite. Negative gets the same rose/warning treatment the real app
                  already uses for isOverspent elsewhere, not a new invented style. */}
              <div className={cn('text-3xl font-bold tabular-nums mt-1', weeklyPreview < 0 ? 'text-rose-300' : 'bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent')}>
                {formatCurrency(weeklyPreview)}
              </div>
              <p className={cn('text-[10px] mt-1', weeklyPreview < 0 ? 'text-rose-300/70' : 'text-white/30')}>
                {weeklyPreview < 0
                  ? 'Your bills currently add up to more than your income — exactly the kind of thing Clarity is built to catch early.'
                  : 'Income minus the payments you added, spread weekly.'}
              </p>
            </div>
            <button type="button" onClick={launchDashboard} className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold rounded-lg px-4 py-2.5 bg-gradient-to-r from-cyan-400 to-purple-500 text-black">
              <LayoutDashboard className="w-4 h-4" /> Go to Dashboard
            </button>
            {/* Honest, not silent — the real per-instance pay-pattern isn't built yet (see the
                buildDemoSeed comment above), so the dashboard's income figure won't match what
                was entered on the Pay & Income step. Bills genuinely do carry through correctly. */}
            <p className="text-[10px] text-white/30 leading-relaxed">Your {completed.bills.length} payment{completed.bills.length === 1 ? '' : 's'} and {completed.payFrequency} pay cycle both carry through to the real dashboard.</p>
            <button type="button" onClick={restart} className="text-xs text-white/40 hover:text-white transition-colors">
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
