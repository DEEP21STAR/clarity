import type { Account, CreditCardAccount, IncomeAnchor, OneOffEntry, RecurringBill, SavingsGoal, SinkingFund } from './types'
import type { DataHealthFinding } from './logic'

/**
 * More Data Health checks, added as a separate module so the original four in logic.ts stay untouched.
 * Same rule as those: every finding is a plain data-consistency fact (a date that does not exist,
 * a goal that is past its date and still short), never a judgment about whether the finances are
 * healthy. Pure function of the data it is given, so it is tested with fixtures.
 */
export function runExtraHealthChecks(params: {
  today: string // YYYY-MM-DD
  bills: RecurringBill[]
  accounts: Account[]
  creditCards: CreditCardAccount[]
  savingsGoals: SavingsGoal[]
  sinkingFunds: SinkingFund[]
  oneOffEntries: OneOffEntry[]
  incomeAnchor: IncomeAnchor
  /** ISO datetime of the last data export or backup, if any. Omit to skip the backup check. */
  lastExportedAt?: string | null
}): DataHealthFinding[] {
  const { today, bills, accounts, savingsGoals, sinkingFunds, oneOffEntries, incomeAnchor, lastExportedAt } = params
  const out: DataHealthFinding[] = []
  const validIso = (d: string | undefined) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d + 'T12:00:00Z'))
  const money = (n: number) => `$${n.toFixed(2)}`

  for (const b of bills) {
    if (b.frequency === 'monthly' && (!Number.isInteger(b.dueDay) || b.dueDay < 1 || b.dueDay > 31)) {
      out.push({ id: `dueday-${b.id}`, severity: 'warning', message: `"${b.name}" is monthly but its due day (${String(b.dueDay)}) is not a day of the month from 1 to 31.` })
    }
    if (b.active && b.amount < 0) {
      out.push({ id: `negbill-${b.id}`, severity: 'warning', message: `"${b.name}" is active with a negative amount (${money(b.amount)}): a bill is normally a positive number.` })
    }
  }

  const accountNames = new Map<string, number>()
  for (const a of accounts) accountNames.set(a.name.trim().toLowerCase(), (accountNames.get(a.name.trim().toLowerCase()) ?? 0) + 1)
  for (const [name, n] of accountNames) {
    if (n > 1) out.push({ id: `dupacct-${name}`, severity: 'warning', message: `${n} accounts are named "${name}": balances may be counted twice.` })
  }

  for (const g of savingsGoals) {
    if (!(g.targetAmount > 0)) out.push({ id: `goalzero-${g.id}`, severity: 'warning', message: `The savings goal "${g.name}" has no target amount, so it can never complete.` })
    else if (g.contributedAmount > g.targetAmount) out.push({ id: `goalover-${g.id}`, severity: 'info', message: `"${g.name}" has ${money(g.contributedAmount)} saved against a ${money(g.targetAmount)} target: already past its goal.` })
    if (g.targetDate && validIso(g.targetDate) && g.targetDate < today && g.contributedAmount < g.targetAmount) {
      out.push({ id: `goaldate-${g.id}`, severity: 'warning', message: `"${g.name}" was due ${g.targetDate} and is still ${money(g.targetAmount - g.contributedAmount)} short: move the date or the target.` })
    }
    if (g.targetDate && !validIso(g.targetDate)) out.push({ id: `goalbaddate-${g.id}`, severity: 'warning', message: `"${g.name}" has a target date that is not a real date (${g.targetDate}).` })
  }

  for (const f of sinkingFunds) {
    if (!(f.targetAmount > 0)) out.push({ id: `fundzero-${f.id}`, severity: 'warning', message: `The fund "${f.name}" has no target amount.` })
    if (!validIso(f.targetDate)) out.push({ id: `fundbaddate-${f.id}`, severity: 'warning', message: `The fund "${f.name}" has a due date that is not a real date (${f.targetDate}).` })
    else if (f.targetDate < today && f.currentSaved < f.targetAmount) {
      out.push({ id: `funddate-${f.id}`, severity: 'warning', message: `"${f.name}" was due ${f.targetDate} and has ${money(f.currentSaved)} of ${money(f.targetAmount)}: the due date has passed.` })
    }
    if (f.currentSaved > f.targetAmount && f.targetAmount > 0) out.push({ id: `fundover-${f.id}`, severity: 'info', message: `"${f.name}" holds ${money(f.currentSaved)}, more than its ${money(f.targetAmount)} target.` })
  }

  if (!(incomeAnchor.weeklyAmount > 0)) out.push({ id: 'income-weekly', severity: 'warning', message: 'The weekly pay amount is $0 or missing, so the forecast has no income.' })
  if (!validIso(incomeAnchor.anchorDate)) out.push({ id: 'income-date', severity: 'warning', message: `The payday anchor date is not a real date (${incomeAnchor.anchorDate}): paydays cannot be worked out.` })

  const oneYearOut = new Date(Date.parse(today + 'T12:00:00Z') + 366 * 86_400_000).toISOString().slice(0, 10)
  for (const e of oneOffEntries) {
    if (validIso(e.date) && e.date > oneYearOut) out.push({ id: `oneoff-far-${e.id}`, severity: 'warning', message: `"${e.description}" is dated ${e.date}, more than a year ahead: check the year.` })
    if (!validIso(e.date)) out.push({ id: `oneoff-bad-${e.id}`, severity: 'warning', message: `"${e.description}" has a date that is not a real date (${e.date}).` })
    if (e.amount === 0) out.push({ id: `oneoff-zero-${e.id}`, severity: 'info', message: `"${e.description}" is a $0 one-off entry.` })
  }

  if (lastExportedAt !== undefined) {
    const last = lastExportedAt ? Date.parse(lastExportedAt) : NaN
    const days = Number.isFinite(last) ? Math.floor((Date.parse(today + 'T12:00:00Z') - last) / 86_400_000) : null
    if (days === null) out.push({ id: 'backup-never', severity: 'info', message: 'No backup or export has been saved from this device yet: everything lives only here.' })
    else if (days > 30) out.push({ id: 'backup-stale', severity: 'info', message: `The last backup or export was ${days} days ago: save a fresh encrypted backup.` })
  }
  return out
}
