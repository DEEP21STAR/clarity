import { useId, useMemo } from 'react'
import { Waves } from 'lucide-react'
import { useStore } from '@/lib/store'
import { monthlyEquivalent, nzNetIncome, auNetIncome } from '@/lib/logic'
import { buildMoneyFlow, flowBands } from '@/lib/moneyFlow'
import { formatCurrency } from '@/lib/utils'
import { StatCard } from './StatCard'

/** Same colours as the bill category breakdown on Budgets, so a colour means the same thing on both screens. */
const CATEGORY_COLORS: Record<string, string> = { housing: '#a855f7', utilities: '#22d3ee', insurance: '#34d399', subscription: '#ec4899', debt: '#ff2d55', other: '#f59e0b' }

const W = 320, H = 150, BAR = 10
const LABEL: Record<string, string> = { housing: 'Housing', utilities: 'Utilities', insurance: 'Insurance', subscription: 'Subscriptions', debt: 'Debt', other: 'Other', leftover: 'Leftover' }

/**
 * Where a month's income goes, drawn as ribbons from one income column into bills by category and what is left. The widths are the real
 * amounts. The ribbons reveal left to right once and then drift very slowly; both are off under reduced motion. The same figures are
 * listed underneath as text, so the picture adds to the numbers rather than replacing them.
 */
export function MoneyFlowRibbon() {
  const { state } = useStore()
  const id = useId()
  const flow = useMemo(() => {
    const net = state.country === 'NZ' ? nzNetIncome(state.grossAnnualIncome) : auNetIncome(state.grossAnnualIncome)
    const cats = (['housing', 'utilities', 'insurance', 'subscription', 'debt', 'other'] as const).map((cat) => ({
      name: cat,
      color: CATEGORY_COLORS[cat],
      value: state.bills.filter((b) => b && b.active && b.category === cat).reduce((s, b) => s + monthlyEquivalent(b.amount, b.frequency), 0),
    }))
    return buildMoneyFlow(net.net / 12, cats)
  }, [state.country, state.grossAnnualIncome, state.bills])

  if (!flow) return null
  const bands = flowBands(flow, H)
  const mid = BAR + (W - BAR * 2) / 2
  const srcEnd = bands[bands.length - 1].y1
  const incomeH = flow.income * ((H - (bands.length - 1) * 3) / flow.total)
  const summary = flow.shortfall > 0
    ? `Bills of ${formatCurrency(flow.bills)} a month are ${formatCurrency(flow.shortfall)} more than your ${formatCurrency(flow.income)} income.`
    : `Of ${formatCurrency(flow.income)} a month, ${formatCurrency(flow.bills)} goes to bills and ${formatCurrency(flow.leftover)} is left.`

  return (
    <StatCard label="Where your income goes" glow={flow.shortfall > 0 ? 'danger' : 'cyan'} tilt={false}>
      <p className="mt-3 flex items-start gap-2 text-sm text-white/75" data-testid="money-flow-summary">
        <Waves className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" /> {summary}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={summary} className="money-flow mt-3 h-40 w-full overflow-visible" data-testid="money-flow">
        <defs>
          <clipPath id={`${id}-reveal`}><rect x="0" y="-4" width={W} height={H + 8} className="money-flow-reveal" /></clipPath>
        </defs>
        <g clipPath={`url(#${id}-reveal)`}>
          {bands.map((b, i) => {
            const x0 = BAR, x1 = W - BAR
            const d = `M${x0} ${b.y0.toFixed(2)} C${mid} ${b.y0.toFixed(2)} ${mid} ${b.ty0.toFixed(2)} ${x1} ${b.ty0.toFixed(2)} L${x1} ${b.ty1.toFixed(2)} C${mid} ${b.ty1.toFixed(2)} ${mid} ${b.y1.toFixed(2)} ${x0} ${b.y1.toFixed(2)} Z`
            return <path key={b.name} d={d} fill={b.color} opacity={b.name === 'leftover' ? 0.55 : 0.4} className="money-flow-band" style={{ animationDelay: `${i * 0.35}s` }} data-band={b.name} />
          })}
          <rect x="0" y="0" width={BAR} height={incomeH} rx="3" fill="#67e8f9" />
          {flow.shortfall > 0 && <rect x="0" y={incomeH} width={BAR} height={srcEnd - incomeH} rx="3" fill="#fb7185" />}
          {bands.map((b) => <rect key={b.name} x={W - BAR} y={b.ty0} width={BAR} height={Math.max(1, b.ty1 - b.ty0)} rx="3" fill={b.color} />)}
        </g>
      </svg>
      <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm min-[420px]:grid-cols-2" data-testid="money-flow-legend">
        {flow.parts.map((p) => (
          <li key={p.name} className="flex items-center justify-between gap-3 text-white/80">
            <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden="true" /><span className="truncate">{LABEL[p.name] ?? p.name}</span></span>
            <span className="tabular-nums text-white/70">{formatCurrency(p.value)}</span>
          </li>
        ))}
        {flow.shortfall > 0 && (
          <li className="flex items-center justify-between gap-3 font-semibold text-rose-300">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400" aria-hidden="true" />Shortfall</span>
            <span className="tabular-nums">{formatCurrency(flow.shortfall)}</span>
          </li>
        )}
      </ul>
    </StatCard>
  )
}
