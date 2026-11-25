/**
 * A one-time "What's new" list. It shows once per release id, only when the app already holds some of your data (a brand-new app has
 * nothing to compare against), and stays hidden once dismissed. To announce a later release, change RELEASE.id and the items.
 */
export interface WhatsNewItem { text: string; tab?: string; tabLabel?: string }
export interface Release { id: string; items: WhatsNewItem[] }

export const RELEASE: Release = {
  id: '2026-11-25',
  items: [
    { text: 'Budget trend lines and month-end pace', tab: 'budgets', tabLabel: 'Budgets' },
    { text: 'Six-month Net Worth projection', tab: 'networth', tabLabel: 'Net Worth' },
    { text: 'Where your income goes (Dashboard)', tab: 'dashboard', tabLabel: 'Dashboard' },
    { text: 'Backup reminder and visit summary', tab: 'tools', tabLabel: 'Back up' },
    { text: 'Damaged saved data no longer blanks a screen' },
  ],
}

export function shouldShowWhatsNew(args: { seenId: string | null | undefined; releaseId: string; transactionCount: number; historyDays: number }): boolean {
  const { seenId, releaseId, transactionCount, historyDays } = args
  if (!releaseId) return false
  if (seenId === releaseId) return false
  return transactionCount > 0 || historyDays >= 3
}
