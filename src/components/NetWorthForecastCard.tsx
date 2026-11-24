import { useId, useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { useStore } from '@/lib/store'
import { calcNetWorth, monthlyEquivalent, nzNetIncome, auNetIncome } from '@/lib/logic'
import { forecastNetWorth } from '@/lib/netWorthForecast'
import { cn, formatCurrency, todayIso } from '@/lib/utils'
import { StatCard } from './StatCard'

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Net worth over the next six months if what is left after income and bills keeps being added, as it is today. A plain projection of
 * your own figures (no interest, no investment growth, no spending outside your bills), and the card says exactly that.
 */
export function NetWorthForecastCard() {
  const { state } = useStore()
  const id = useId()
  const today = todayIso()
  const forecast = useMemo(() => {
    const nw = calcNetWorth(state.accounts, state.creditCards, state.debts).netWorth
    const net = state.country === 'NZ' ? nzNetIncome(state.grossAnnualIncome) : auNetIncome(state.grossAnnualIncome)
    const bills = state.bills.filter((b) => b && b.active).reduce((s, b) => s + monthlyEquivalent(b.amount, b.frequency), 0)
    return forecastNetWorth({ netWorthNow: nw, monthlyNetIncome: net.net / 12, monthlyBills: bills, todayIso: today })
  }, [state.accounts, state.creditCards, state.debts, state.country, state.grossAnnualIncome, state.bills, today])

  if (!forecast) return null
  const up = forecast.change >= 0
  const color = up ? '#34d399' : '#fb7185'
  const headline = `${formatCurrency(forecast.end)} in 6 months, ${up ? 'up' : 'down'} ${formatCurrency(Math.abs(forecast.change))}`
  const rule = forecast.monthlyChange >= 0
    ? `Each month adds ${formatCurrency(forecast.monthlyChange)}: your income after tax minus your active bills.`
    : `Each month takes away ${formatCurrency(-forecast.monthlyChange)}: your bills are more than your income after tax.`

  return (
    <StatCard label="Next 6 months, at this pace" glow={up ? 'success' : 'danger'} tilt={false} tooltip="A plain projection from your own figures: net worth now, plus what is left each month after tax and bills. It has no interest, no investment growth and no spending outside your bills list.">
      <p className="mt-3 flex items-start gap-2 text-lg font-bold tabular-nums text-white" data-testid="nw-forecast-headline" style={{ color }}>
        {up ? <TrendingUp className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" /> : <TrendingDown className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" />}
        <span>{headline}</span>
      </p>
      <p className="mt-1 text-sm text-white/70">{rule}</p>
      <div className="mt-4 h-56 w-full" role="img" aria-label={`Net worth forecast: ${forecast.points.map((p) => `${p.label} ${formatCurrency(p.value)}`).join(', ')}`} data-testid="nw-forecast-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={forecast.points} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="label" stroke="rgba(255,255,255,0.6)" fontSize={12} tickLine={false} interval="preserveStartEnd" />
            <YAxis stroke="rgba(255,255,255,0.6)" fontSize={12} tickLine={false} width={48} tickFormatter={(v) => `${Number(v) < 0 ? '-' : ''}$${Math.abs(Number(v) / 1000).toFixed(0)}k`} domain={['dataMin', 'dataMax']} />
            <Tooltip contentStyle={{ background: '#0b0d14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} labelStyle={{ color: '#fff' }} formatter={(v) => [formatCurrency(Number(v)), 'Net worth']} />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#${id}-fill)`} dot={{ r: 3, fill: color }} isAnimationActive={!reducedMotion()} animationDuration={1200} animationEasing="ease-out" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className={cn('mt-2 text-xs text-white/60')}>A projection from your own figures, not a prediction. No interest or investment growth, and no spending outside your bills.</p>
    </StatCard>
  )
}
