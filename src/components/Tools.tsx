import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { StatCard } from './StatCard'
import { CountUp } from './CountUp'
import { DataExportPanel } from './DataExportPanel'
import { PaymentHistoryPanel } from './PaymentHistoryPanel'
import { SegmentedControl } from './SegmentedControl'
import { calcWfhFixedRate, gstOnExclusive, gstFromInclusive, NZ_WFH_FIXED_RATE_PER_HOUR, AU_WFH_FIXED_RATE_PER_HOUR, calcRoundUpSavings, runDataHealthCheck, projectBalanceSeries } from '@/lib/logic'
import { cn, formatCurrency, formatShortDate, todayIso } from '@/lib/utils'
import { Plus, Trash2, Volume2, VolumeX, AlertTriangle, Info, ShieldCheck, Coffee, TrendingUp, Award, Flame, PiggyBank, Lock, BellRing, Mic } from 'lucide-react'
import { useUndoableDelete } from '@/lib/useUndoableDelete'
import { DateField } from './DateField'
import { Help } from './Help'
import { isNotificationSupported, getNotificationPermission, requestNotificationPermission } from '@/lib/notifications'
import { isSpeechRecognitionSupported, startListening, parseVoiceTranscript } from '@/lib/voiceInput'

export function Tools() {
  const { state, addOneOffEntry, removeOneOffEntry, setSoundEnabled, setTextScale, setBillAlertsEnabled, setAccentTheme } = useStore()
  const withUndo = useUndoableDelete()
  const [hoursPerWeek, setHoursPerWeek] = useState(15)
  const [weeksPerYear, setWeeksPerYear] = useState(48)
  const [gstDirection, setGstDirection] = useState<'ex' | 'inc'>('ex')
  const [gstAmount, setGstAmount] = useState(100)
  const [roundTo, setRoundTo] = useState(5)
  const [oneOffDesc, setOneOffDesc] = useState('')
  const [oneOffAmount, setOneOffAmount] = useState(0)
  const [oneOffDate, setOneOffDate] = useState(todayIso())
  const [extraUsageDesc, setExtraUsageDesc] = useState('')
  const [extraUsageAmount, setExtraUsageAmount] = useState(0)
  const [extraUsageDate, setExtraUsageDate] = useState(todayIso())
  const [whatIfExtraPerWeek, setWhatIfExtraPerWeek] = useState(0)
  const [notifPermission, setNotifPermission] = useState(getNotificationPermission())
  const [listening, setListening] = useState(false)
  const [voiceHeard, setVoiceHeard] = useState('')

  const handleEnableAlerts = async () => {
    const result = await requestNotificationPermission()
    setNotifPermission(result)
    if (result === 'granted') setBillAlertsEnabled(true)
  }

  // "proceed with all" — Voice quick-log. Fills the existing one-off entry form rather than
  // committing directly: parseVoiceTranscript never guesses a sign or category, so the amount
  // lands as a plain positive number and Deep still reviews/edits before hitting "Add entry" —
  // same confirm-before-commit as typing it manually.
  const startVoiceQuickLog = () => {
    setVoiceHeard('')
    const listener = startListening(
      (transcript) => {
        setListening(false)
        setVoiceHeard(transcript)
        const { description, amount } = parseVoiceTranscript(transcript)
        if (description) setOneOffDesc(description)
        if (amount !== null) setOneOffAmount(amount)
      },
      () => setListening(false)
    )
    if (listener) setListening(true)
  }

  const roundUpSavings = useMemo(() => calcRoundUpSavings(state.transactions, roundTo), [state.transactions, roundTo])

  const rate = state.country === 'NZ' ? NZ_WFH_FIXED_RATE_PER_HOUR : AU_WFH_FIXED_RATE_PER_HOUR
  const wfhDeduction = useMemo(() => calcWfhFixedRate(hoursPerWeek, weeksPerYear, rate), [hoursPerWeek, weeksPerYear, rate])

  const gstResult = useMemo(
    () => (gstDirection === 'ex' ? gstOnExclusive(gstAmount, state.country) : gstFromInclusive(gstAmount, state.country)),
    [gstDirection, gstAmount, state.country]
  )

  // Round 21, items #10/#11 — real data-integrity self-check, recomputed live from the actual
  // current state (no manual "run" step needed — same always-fresh philosophy as every other
  // card in this app). See runDataHealthCheck()'s doc comment in logic.ts for exactly what
  // each finding category checks and why.
  const healthFindings = useMemo(
    () => runDataHealthCheck({ bills: state.bills, creditCards: state.creditCards, accounts: state.accounts }),
    [state.bills, state.creditCards, state.accounts]
  )

  // 2026-09-23 round 8 — "what-if income simulator" (Deep, via the ideation table). Reuses the
  // exact same projectBalanceSeries the real Cash-Flow Forecast chart uses, just run twice: once
  // with the real incomeAnchor, once with a hypothetical raise added to weeklyAmount (adding to
  // weeklyAmount — not fortnightlyBonusAmount — is correct regardless of the account's own
  // pattern, since incomeOnDate always pays weeklyAmount every payday and only ADDS the
  // fortnightly bonus on top on combined weeks; see incomeOnDate's own doc comment).
  const whatIfStartBalance = useMemo(
    () => state.accounts.filter((a) => a.countsTowardLiveFunds).reduce((s, a) => s + a.value, 0),
    [state.accounts]
  )
  const whatIfComparison = useMemo(() => {
    const today = todayIso()
    const real = projectBalanceSeries(whatIfStartBalance, today, 30, state.bills, state.periodicBills, state.oneOffEntries, state.incomeAnchor)
    const hypotheticalAnchor = { ...state.incomeAnchor, weeklyAmount: state.incomeAnchor.weeklyAmount + whatIfExtraPerWeek }
    const hypothetical = projectBalanceSeries(whatIfStartBalance, today, 30, state.bills, state.periodicBills, state.oneOffEntries, hypotheticalAnchor)
    return { realEnd: real[real.length - 1].balance, hypotheticalEnd: hypothetical[hypothetical.length - 1].balance }
  }, [whatIfStartBalance, state.bills, state.periodicBills, state.oneOffEntries, state.incomeAnchor, whatIfExtraPerWeek])

  // 2026-09-23 round 10 — "Achievements/badges gallery" (Deep, via the ideation table).
  // Deliberately built only from data the app already genuinely tracks -- no invented
  // criteria. Streak milestones already exist as tiny inline pills on Upcoming Payments
  // (SpendPaceTracker.tsx); this is the real dedicated showcase, showing locked AND unlocked
  // badges (not just the ones already hit) so it reads as a real collection.
  const goalsCompleted = useMemo(
    () => state.savingsGoals.filter((g) => g.targetAmount > 0 && g.contributedAmount >= g.targetAmount).length,
    [state.savingsGoals]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="gradient-heading text-2xl font-bold tracking-tight">Tools</h2>
          <p className="text-sm text-white/50 mt-1">Home-office deduction and GST calculators.</p>
        </div>
        {/* #38 — real sound design toggle, OFF by default. */}
        <button
          onClick={() => setSoundEnabled(!state.soundEnabled)}
          title={state.soundEnabled ? 'Sound effects on — click to mute' : 'Sound effects off — click to enable chimes on bill-paid / streak milestones'}
          className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 border transition-colors ${state.soundEnabled ? 'text-cyan-300 border-cyan-400/40 bg-cyan-400/10' : 'text-white/40 border-white/10 hover:border-white/20'}`}
        >
          {state.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          Sound {state.soundEnabled ? 'on' : 'off'}
        </button>
      </div>

      <Help />

      {/* 2026-09-23 round 7 — "ability to increase font sizes with 3 options" (Deep). Scales
          every rem-based text size across the whole app — see index.css's data-text-scale
          rules and App.tsx's effect that sets the attribute on <html>. Pinch-to-zoom itself
          was already permitted by the viewport meta tag (never explicitly blocked); this is
          the separate, explicit in-app control alongside it. */}
      <StatCard label="Display" glow="cyan" tooltip="Scales all text across the app. Pinch-to-zoom also works everywhere for extra magnification.">
        <div className="mt-4">
          <label className="text-xs text-white/50 mb-1.5 block">Text size</label>
          <SegmentedControl
            value={state.textScale}
            onChange={setTextScale}
            options={[
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' },
            ]}
          />
        </div>
      </StatCard>

      {/* "proceed with all" — Settings > Themes, contained scope (see index.css's --theme-1/2/3
          comment): swaps the app's shared brand gradient only. Semantic StatCard colors
          (danger/success/amber) and a couple of one-off hardcoded hero-number gradients
          elsewhere are unaffected — that's a much bigger refactor, out of scope here. */}
      <StatCard label="Theme" glow="purple" tooltip="Changes the app's brand gradient — logo, headings, nav glow, card hover border, wizard frame. Warning/success/danger colors elsewhere stay the same on purpose, since those carry real meaning.">
        <div className="mt-4 grid grid-cols-4 gap-2">
          {(
            [
              { value: 'aurora', label: 'Aurora', from: '#22d3ee', to: '#a855f7' },
              { value: 'sunset', label: 'Sunset', from: '#fb923c', to: '#f43f5e' },
              { value: 'emerald', label: 'Emerald', from: '#34d399', to: '#06b6d4' },
              { value: 'violet', label: 'Violet', from: '#a855f7', to: '#ec4899' },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              onClick={() => setAccentTheme(t.value)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors',
                state.accentTheme === t.value ? 'border-white/40 bg-white/5' : 'border-white/10 hover:border-white/20'
              )}
            >
              <span
                className="w-full h-6 rounded-md"
                style={{ background: `linear-gradient(90deg, ${t.from}, ${t.to})` }}
              />
              <span className={cn('text-[11px]', state.accentTheme === t.value ? 'text-white' : 'text-white/50')}>{t.label}</span>
            </button>
          ))}
        </div>
      </StatCard>

      {/* "proceed with all" — Bill-due push notifications, honestly scoped: real browser
          Notification API, fires while this tab/PWA is open (checked on load + every 30 min).
          No push server behind it — cannot wake a fully-closed app. Copy below says exactly
          that instead of overselling "even when closed" push. */}
      <StatCard label="Bill Alerts" glow="danger" tooltip="Real browser notifications for bills due today or tomorrow — but only while Clarity is open in a tab or as an installed app. There's no server behind this, so it can't wake a fully-closed browser or notify while your phone is asleep.">
        {!isNotificationSupported() ? (
          <p className="mt-4 text-sm text-white/40">Notifications aren't supported in this browser.</p>
        ) : notifPermission === 'denied' ? (
          <p className="mt-4 text-sm text-amber-300/80 flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> Blocked in your browser settings. Enable notifications for this site to turn alerts back on.</p>
        ) : notifPermission === 'granted' && state.billAlertsEnabled ? (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-emerald-300 flex items-center gap-1.5"><BellRing className="w-4 h-4" /> On — bills due today/tomorrow will alert you while the app is open.</span>
            <button onClick={() => setBillAlertsEnabled(false)} className="text-xs text-white/40 hover:text-white/70 underline">Turn off</button>
          </div>
        ) : (
          <button
            onClick={handleEnableAlerts}
            className="mt-4 flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/20 transition-colors"
          >
            <BellRing className="w-4 h-4" /> Enable bill alerts
          </button>
        )}
      </StatCard>

      <StatCard label="Achievements" glow="amber" tooltip="Real milestones this account has actually hit — no fabricated criteria.">
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[7, 30, 100].map((m) => {
            const unlocked = state.streak.milestonesHit.includes(m)
            return (
              <div
                key={m}
                className={cn(
                  'rounded-xl border p-3 flex flex-col items-center text-center gap-1.5',
                  unlocked ? 'border-amber-400/40 bg-amber-500/10' : 'border-white/10 bg-black/20 opacity-50'
                )}
              >
                {unlocked ? <Award className="w-6 h-6 text-amber-300" /> : <Lock className="w-5 h-5 text-white/30" />}
                <span className={cn('text-xs font-semibold', unlocked ? 'text-amber-200' : 'text-white/40')}>{m}-day streak</span>
              </div>
            )
          })}
        </div>
        <div className="mt-4 flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-white/60">Best streak: <span className="font-bold text-white">{state.streak.best}</span> days</span>
          </div>
          <div className="flex items-center gap-1.5">
            <PiggyBank className="w-4 h-4 text-purple-300" />
            <span className="text-sm text-white/60">Goals completed: <span className="font-bold text-white">{goalsCompleted}</span></span>
          </div>
        </div>
      </StatCard>

      <StatCard label="Home Office / WFH Deduction" glow="cyan">
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/50">Hours worked from home / week</label>
            <input type="number" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(parseFloat(e.target.value) || 0)} className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-cyan-400/50" />
          </div>
          <div>
            <label className="text-xs text-white/50">Weeks / year</label>
            <input type="number" value={weeksPerYear} onChange={(e) => setWeeksPerYear(parseFloat(e.target.value) || 0)} className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-cyan-400/50" />
          </div>
        </div>
        <div className="mt-4 text-sm text-white/50">
          Fixed rate: {formatCurrency(rate)}/hr ({state.country === 'NZ' ? 'IRD' : 'ATO'} method)
        </div>
        {/* #10 — real animated result reveal, re-triggered every recalculation (keyed on the actual result) */}
        <div key={wfhDeduction} className="result-reveal">
          <div className="mt-2 text-3xl font-bold text-cyan-300 tabular-nums"><CountUp value={wfhDeduction} prefix="$" /></div>
          <p className="text-xs text-white/40 mt-1">Estimated annual deduction — editable rate/inputs, not a lodged claim.</p>
        </div>
      </StatCard>

      <StatCard label="GST Calculator" glow="purple">
        <div className="mt-4">
          <SegmentedControl
            value={gstDirection}
            onChange={setGstDirection}
            options={[{ value: 'ex', label: 'Ex-GST → Inc-GST' }, { value: 'inc', label: 'Inc-GST → Ex-GST' }]}
          />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-white/40">$</span>
          <input type="number" value={gstAmount} onChange={(e) => setGstAmount(parseFloat(e.target.value) || 0)} className="bg-transparent text-2xl font-bold tabular-nums text-purple-200 outline-none border-b border-white/10 focus:border-purple-400/60 w-full" />
        </div>
        <div key={gstResult.gst} className="result-reveal mt-4 grid grid-cols-3 gap-4 text-sm">
          <Metric label="Ex-GST" value={gstResult.amountExGst} />
          <Metric label="GST" value={gstResult.gst} />
          <Metric label="Inc-GST" value={gstResult.amountIncGst} />
        </div>
        <p className="text-xs text-white/40 mt-3">{state.country} GST rate: {state.country === 'NZ' ? '15%' : '10%'}.</p>
      </StatCard>

      <StatCard label="What-If Income Simulator" glow="success" tooltip="Reuses the same 30-day projection as the Cash-Flow Forecast on Upcoming Payments — just run twice, with and without the hypothetical amount.">
        <div className="mt-4 flex flex-col md:flex-row items-start md:items-end gap-4">
          <div>
            <label className="text-xs text-white/50">Extra income, per week</label>
            <div className="mt-1 flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2">
              <span className="text-white/40">$</span>
              <input
                type="number"
                step="1"
                value={whatIfExtraPerWeek || ''}
                onChange={(e) => setWhatIfExtraPerWeek(parseFloat(e.target.value) || 0)}
                placeholder="e.g. a $50/week raise"
                className="w-40 bg-transparent outline-none tabular-nums text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wide">Balance in 30 days — now</p>
              <p className="text-lg font-bold tabular-nums text-white/70">{formatCurrency(whatIfComparison.realEnd)}</p>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-400 mt-3" />
            <div>
              <p className="text-[10px] text-emerald-300/70 uppercase tracking-wide">With this change</p>
              <p className="text-lg font-bold tabular-nums text-emerald-300">{formatCurrency(whatIfComparison.hypotheticalEnd)}</p>
            </div>
          </div>
        </div>
        {whatIfExtraPerWeek > 0 && (
          <p className="mt-3 text-xs text-white/40">
            An extra {formatCurrency(whatIfExtraPerWeek)}/week would leave you {formatCurrency(whatIfComparison.hypotheticalEnd - whatIfComparison.realEnd)} better off after 30 days.
          </p>
        )}
      </StatCard>

      <StatCard label="Round-Up Savings Simulator" glow="amber">
        <p className="mt-4 text-xs text-amber-300/80 font-semibold uppercase tracking-wide">Simulation only — moves no real money</p>
        <div className="mt-2 flex items-center gap-2 text-sm text-white/50">
          Round every purchase up to the nearest
          <select value={roundTo} onChange={(e) => setRoundTo(Number(e.target.value))} className="bg-black/40 rounded px-2 py-1 text-xs outline-none border border-white/10">
            {[1, 2, 5, 10].map((r) => <option key={r} value={r}>${r}</option>)}
          </select>
        </div>
        <div key={roundUpSavings} className="result-reveal">
          <div className="mt-2 text-3xl font-bold text-amber-300 tabular-nums"><CountUp value={roundUpSavings} prefix="$" /></div>
          <p className="text-xs text-white/40 mt-1">You'd have "saved" this much across all imported transactions, if every purchase rounded up.</p>
        </div>
      </StatCard>

      <StatCard label="One-Off Entries" glow="cyan" tooltip={isSpeechRecognitionSupported() ? 'Tap the mic to fill this form by voice — it never guesses income vs. expense, so review the amount before adding.' : 'Voice fill needs Chrome, Edge, or Safari — not supported in this browser.'}>
        <p className="mt-4 text-xs text-white/40">One-off income/expenses feed the Cash-Flow Forecast chart on Upcoming Payments — a bonus, a big purchase, anything outside the regular bill/pay cycle.</p>
        {isSpeechRecognitionSupported() && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={startVoiceQuickLog}
              disabled={listening}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors',
                listening ? 'border-rose-400/50 bg-rose-500/10 text-rose-200' : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20'
              )}
            >
              <Mic className={cn('w-3.5 h-3.5', listening && 'animate-pulse')} /> {listening ? 'Listening…' : 'Voice quick-log'}
            </button>
            {voiceHeard && !listening && <span className="text-xs text-white/40">Heard: "{voiceHeard}"</span>}
          </div>
        )}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
          <input value={oneOffDesc} onChange={(e) => setOneOffDesc(e.target.value)} placeholder="Description" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-400/50 md:col-span-2" />
          <DateField
            value={oneOffDate}
            onChange={setOneOffDate}
            inputClassName="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
            overlayClassName="px-3 text-sm"
          />
          <div className="flex items-center gap-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2">
            <span className="text-white/40">$</span>
            <input type="number" step="0.01" value={oneOffAmount} onChange={(e) => setOneOffAmount(parseFloat(e.target.value) || 0)} className="w-full bg-transparent outline-none tabular-nums text-sm" placeholder="+income / -expense" />
          </div>
        </div>
        <button
          onClick={() => {
            if (!oneOffDesc.trim() || oneOffAmount === 0) return
            addOneOffEntry({ id: `oneoff-${Date.now()}`, date: oneOffDate, description: oneOffDesc.trim(), amount: oneOffAmount })
            setOneOffDesc(''); setOneOffAmount(0)
          }}
          className="mt-2 flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
        >
          <Plus className="w-3 h-3" /> Add entry
        </button>
        <div className="mt-3 space-y-1">
          {state.oneOffEntries.filter((e) => e.category !== 'extraUsage').map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm border-t border-white/5 pt-1.5">
              <span className="text-white/60">{formatShortDate(e.date)} — {e.description}</span>
              <div className="flex items-center gap-2">
                <span className={`tabular-nums ${e.amount < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{formatCurrency(e.amount)}</span>
                <button onClick={() => withUndo(`"${e.description}" removed`, () => removeOneOffEntry(e.id))} className="text-white/30 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </StatCard>

      <StatCard label="Extra Usage Purchases" glow="amber" tooltip="A freely-editable log for ad-hoc extra usage purchases (e.g. Claude API overage) — not a fixed recurring bill. Feeds the same Cash-Flow Forecast as any other one-off expense.">
        <p className="mt-4 text-xs text-white/40">Log any one-off extra-usage purchase as it happens — API overage, an extra credit top-up, anything outside your fixed subscriptions.</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
          <input value={extraUsageDesc} onChange={(e) => setExtraUsageDesc(e.target.value)} placeholder="e.g. Claude API overage" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400/50 md:col-span-2" />
          <DateField
            value={extraUsageDate}
            onChange={setExtraUsageDate}
            inputClassName="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400/50"
            overlayClassName="px-3 text-sm"
          />
          <div className="flex items-center gap-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2">
            <span className="text-white/40">$</span>
            <input type="number" step="0.01" value={extraUsageAmount} onChange={(e) => setExtraUsageAmount(parseFloat(e.target.value) || 0)} className="w-full bg-transparent outline-none tabular-nums text-sm" placeholder="amount" />
          </div>
        </div>
        <button
          onClick={() => {
            if (!extraUsageDesc.trim() || extraUsageAmount === 0) return
            addOneOffEntry({ id: `extra-usage-${Date.now()}`, date: extraUsageDate, description: extraUsageDesc.trim(), amount: -Math.abs(extraUsageAmount), category: 'extraUsage' })
            setExtraUsageDesc(''); setExtraUsageAmount(0)
          }}
          className="mt-2 flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200"
        >
          <Plus className="w-3 h-3" /> Log extra usage purchase
        </button>
        <div className="mt-3 space-y-1">
          {state.oneOffEntries.filter((e) => e.category === 'extraUsage').map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm border-t border-white/5 pt-1.5">
              <span className="text-white/60">{formatShortDate(e.date)} — {e.description}</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-rose-300">{formatCurrency(e.amount)}</span>
                <button onClick={() => withUndo(`"${e.description}" removed`, () => removeOneOffEntry(e.id))} className="text-white/30 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
          {state.oneOffEntries.filter((e) => e.category === 'extraUsage').length === 0 && (
            <p className="text-xs text-white/30 pt-1">No extra usage purchases logged yet.</p>
          )}
        </div>
      </StatCard>

      <PaymentHistoryPanel />

      {/* Round 21, items #10/#11 — real data-integrity self-check: likely duplicate
          subscriptions, active $0 bills, over-limit cards, and unexpected negative balances.
          Plain data-consistency facts, not a financial-health opinion (that's Dashboard
          Insights) — genuinely different question, genuinely different card. */}
      <StatCard
        label="Data Health Check"
        glow={healthFindings.some((f) => f.severity === 'warning') ? 'amber' : 'success'}
        tooltip="Checks for likely duplicate bills, active bills stuck at $0, card balances over their own stated limit, and unexpected negative balances — real data-consistency facts, not a financial opinion."
      >
        <div className="mt-4 space-y-2">
          {healthFindings.map((f) => (
            <div key={f.id} className="flex items-start gap-2 text-sm">
              {f.severity === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
              )}
              <span className="text-white/70">{f.message}</span>
            </div>
          ))}
          {healthFindings.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <ShieldCheck className="w-4 h-4" /> No data-consistency issues found.
            </div>
          )}
        </div>
      </StatCard>

      <DataExportPanel />

      {/* 2026-09-23 — Clarity is free, donation-supported (same honor-system model as NUTRYOS),
          separate Buy Me a Coffee page so support/interest for each product stays distinct. */}
      <StatCard
        label="Support Clarity"
        glow="purple"
        tooltip="Clarity stays free — this is entirely optional, honor-system support."
      >
        <p className="mt-4 text-xs text-white/40">
          Clarity is free to use — building and hosting it isn't. If it's saving you real time or
          stress, a coffee genuinely helps keep it running. Completely optional, no strings attached.
        </p>
        <a
          href="https://buymeacoffee.com/clarity"
          target="_blank"
          rel="noopener noreferrer"
          className="donation-pulse mt-4 block rounded-xl border border-purple-400/30 bg-purple-400/10 py-3 text-center text-sm font-semibold text-purple-200"
        >
          <span className="inline-flex items-center gap-2 justify-center">
            <Coffee className="w-4 h-4" /> Buy me a coffee
          </span>
        </a>
      </StatCard>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs text-white/40 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold tabular-nums text-white">{formatCurrency(value)}</div>
    </div>
  )
}
