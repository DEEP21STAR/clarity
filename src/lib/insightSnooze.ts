import { addDaysIso } from './logic'

/**
 * Round 21, item #7 — real per-insight snoozing. The Insights list is rule-based and
 * recomputes every render, so a genuinely-true insight ("you're spending faster than
 * planned") would otherwise nag every single session even once Deep has already seen and
 * consciously accepted it for now. A 7-day snooze is stored per insight id — if the
 * UNDERLYING category of problem changes to something more serious, it shows again
 * immediately: generateInsights() gives each insight a stable id per CATEGORY (e.g.
 * 'low-savings-rate'), not per exact number — so snoozing "low savings rate" mutes it while
 * it stays in that band, but a genuine escalation into 'overspend' (a distinct, more severe
 * id) is a different insight entirely and is never suppressed by an old snooze. Honest
 * limitation: it does NOT re-surface early just because the number got slightly worse
 * within the same band (8% -> 4% savings rate, still "low") — that's a deliberate trade-off
 * against re-nagging every session over noise within a band Deep already acknowledged.
 */
const STORAGE_KEY = 'clarity:snoozed-insights'
const SNOOZE_DAYS = 7

type SnoozeMap = Record<string, string> // insight id -> ISO date the snooze expires

function loadSnoozeMap(): SnoozeMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function isInsightSnoozed(insightId: string, todayIsoStr: string): boolean {
  const until = loadSnoozeMap()[insightId]
  return !!until && until > todayIsoStr
}

export function snoozeInsight(insightId: string, todayIsoStr: string): void {
  try {
    const map = loadSnoozeMap()
    map[insightId] = addDaysIso(todayIsoStr, SNOOZE_DAYS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // localStorage unavailable — the insight just won't stay snoozed across reloads.
  }
}
