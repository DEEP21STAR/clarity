import type { QuickCategory } from './liveFunds'

/** Remembers the category last used in the quick-add sheet, so the usual one is already selected next time. */
export const QUICK_ADD_KEY = 'clarity-quickadd-last-category'
const CATEGORIES: readonly QuickCategory[] = ['food', 'fuel', 'personal', 'general', 'extraUsage']

export function parseLastCategory(raw: string | null | undefined): QuickCategory | null {
  return CATEGORIES.find((c) => c === raw) ?? null
}

export function readLastCategory(storage: Pick<Storage, 'getItem'> | undefined): QuickCategory | null {
  try { return parseLastCategory(storage?.getItem(QUICK_ADD_KEY)) } catch { return null }
}

export function writeLastCategory(storage: Pick<Storage, 'setItem'> | undefined, cat: QuickCategory) {
  try { storage?.setItem(QUICK_ADD_KEY, cat) } catch { /* private mode or blocked storage: just fall back to the default next time */ }
}
