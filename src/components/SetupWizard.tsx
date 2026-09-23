import { useEffect, useMemo, useRef, useState } from 'react'
import { SegmentedControl } from './SegmentedControl'
import { DateField } from './DateField'
import { cn, formatCurrency, todayIso } from '@/lib/utils'
import type { Country } from '@/lib/types'
import { Check, ChevronRight, ChevronLeft, Building2, Wallet, Sparkles, Plus, Trash2, Upload, FileText, Info } from 'lucide-react'

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
}

interface WizardConfig {
  primaryName: string
  secondaryName: string
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

export function SetupWizard() {
  const [step, setStep] = useState(0)
  const [primaryName, setPrimaryName] = useState('')
  const [secondaryName, setSecondaryName] = useState('')
  const [country, setCountry] = useState<Country>('NZ')
  const [bank, setBank] = useState('')
  const [payFrequency, setPayFrequency] = useState<Frequency>('weekly')
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [bills, setBills] = useState<WizardBill[]>([])
  const [billName, setBillName] = useState('')
  const [billAmount, setBillAmount] = useState(0)
  const [billFreq, setBillFreq] = useState<Frequency>('monthly')
  const [billDue, setBillDue] = useState(todayIso())
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
    setBills((b) => [...b, { id: `bill-${Date.now()}`, name: billName.trim(), amount: billAmount, frequency: billFreq, nextDue: billDue }])
    setBillName('')
    setBillAmount(0)
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

  const finish = () => {
    const cfg: WizardConfig = {
      primaryName: primaryName.trim(),
      secondaryName: secondaryName.trim(),
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

  const restart = () => {
    clearDemoConfig()
    setCompleted(null)
    setStep(0)
    setPrimaryName('')
    setSecondaryName('')
    setCountry('NZ')
    setBank('')
    setPayFrequency('weekly')
    setMonthlyIncome(0)
    setBills([])
    setCsvFileName(null)
    setCsvPreview(null)
    setCsvError(null)
  }

  const totalMonthlyBills = useMemo(
    () => bills.reduce((sum, b) => sum + (b.frequency === 'weekly' ? b.amount * 4.33 : b.frequency === 'fortnightly' ? b.amount * 2.17 : b.amount), 0),
    [bills]
  )
  const weeklyPreview = completed ? (completed.monthlyIncome - totalMonthlyBills) / 4.33 : 0

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

            {step === 0 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold">Who's this for?</h2>
                <p className="text-xs text-white/40">Just a name — add a second person for a shared household, or leave it blank for a single view.</p>
                <div>
                  <label className="text-xs text-white/50">Your name</label>
                  <input value={primaryName} onChange={(e) => setPrimaryName(e.target.value)} placeholder="e.g. Deep" className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-400/50" />
                </div>
                <div>
                  <label className="text-xs text-white/50">Add a second person (optional)</label>
                  <input value={secondaryName} onChange={(e) => setSecondaryName(e.target.value)} placeholder="e.g. Mimi" className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-400/50" />
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
                <h2 className="text-base font-semibold">How and what do you get paid?</h2>
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Pay cycle</label>
                  <SegmentedControl value={payFrequency} onChange={setPayFrequency} options={FREQ_OPTIONS} />
                </div>
                <div>
                  <label className="text-xs text-white/50">Income, per month (rough total)</label>
                  <div className="mt-1 flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 focus-within:border-cyan-400/50">
                    <span className="text-white/40">$</span>
                    <input type="number" value={monthlyIncome || ''} onChange={(e) => setMonthlyIncome(parseFloat(e.target.value) || 0)} placeholder="Monthly income" className="w-full bg-transparent outline-none tabular-nums text-sm" />
                    <span className="text-white/30 text-xs">/month</span>
                  </div>
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
                  <DateField value={billDue} onChange={setBillDue} inputClassName="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-cyan-400/50" overlayClassName="px-3 text-xs" />
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
                          <span className="text-white/40"> · {formatCurrency(b.amount)} {b.frequency}</span>
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

            <div className="flex items-center justify-between mt-6">
              <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="flex items-center gap-1 text-xs text-white/40 hover:text-white disabled:opacity-0 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
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
        ) : (
          <div className="rounded-2xl border border-cyan-400/30 bg-[#0b0d14] p-6 text-center space-y-5">
            <div className="w-12 h-12 rounded-full bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center mx-auto">
              <Check className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold">{completed.primaryName}{completed.secondaryName ? ` + ${completed.secondaryName}` : ''}, you're set up</h2>
              <p className="text-xs text-white/40 mt-1">{completed.bank} · {completed.country === 'NZ' ? 'New Zealand' : 'Australia'} · {completed.bills.length} payment{completed.bills.length === 1 ? '' : 's'} tracked</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-5">
              <div className="text-[10px] uppercase tracking-wider text-white/40 flex items-center justify-center gap-1.5">
                <Wallet className="w-3 h-3" /> Rough weekly safe-to-spend
              </div>
              <div className="text-3xl font-bold tabular-nums mt-1 bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent">
                {formatCurrency(weeklyPreview)}
              </div>
              <p className="text-[10px] text-white/30 mt-1">Income minus the payments you added, spread weekly.</p>
            </div>
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
