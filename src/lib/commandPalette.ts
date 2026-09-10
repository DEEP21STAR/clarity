/**
 * Round 21, items #3 and #20 — ⌘K palette quality-of-life.
 *
 * #20: real fuzzy subsequence matching, replacing the old plain
 * `.includes()` filter. Typing "dash" or even "gtd" (Go To Dashboard) now
 * matches "Go to Dashboard" — a real ranked score, not just yes/no.
 *
 * #3: real recently/frequently-used command ranking, persisted in
 * localStorage so the palette's empty-query default order gets better the
 * more it's actually used, instead of always listing in registration order.
 */

/**
 * Lower score = better match. Returns null when `query`'s characters don't
 * all appear, in order, somewhere in `text` (case-insensitive) — i.e. no
 * match at all. Score rewards: matches starting earlier in the string, and
 * matches whose characters sit close together (a contiguous "dash" scores
 * better than a scattered "d..a....s...h").
 */
export function fuzzyScore(text: string, query: string): number | null {
  if (query.trim() === '') return 0
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  let lastIndex = -1
  let firstIndex = -1
  let gapPenalty = 0
  for (const ch of q) {
    const idx = t.indexOf(ch, lastIndex + 1)
    if (idx === -1) return null
    if (firstIndex === -1) firstIndex = idx
    if (lastIndex !== -1) gapPenalty += idx - lastIndex - 1
    lastIndex = idx
  }
  return gapPenalty * 2 + firstIndex
}

const USAGE_STORAGE_KEY = 'clarity:cmd-usage'

interface UsageEntry {
  count: number
  lastUsed: number
}

function loadUsage(): Record<string, UsageEntry> {
  try {
    const raw = localStorage.getItem(USAGE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/** Call when a command is actually run — increments its count and bumps its recency. */
export function recordCommandUsage(commandId: string): void {
  try {
    const usage = loadUsage()
    const existing = usage[commandId] ?? { count: 0, lastUsed: 0 }
    usage[commandId] = { count: existing.count + 1, lastUsed: Date.now() }
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usage))
  } catch {
    // localStorage unavailable — ranking just won't persist, no functional loss.
  }
}

/**
 * Sort key: most-used first, ties broken by most-recently-used. Commands never
 * used sort last, in their original relative order (a stable sort, since
 * every never-used command shares the same (0, 0) key).
 */
export function commandUsageRank(commandId: string): [number, number] {
  const usage = loadUsage()
  const entry = usage[commandId]
  return entry ? [-entry.count, -entry.lastUsed] : [0, 0]
}
