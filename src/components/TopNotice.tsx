import { BackupNudgeStrip } from './BackupNudgeStrip'
import { SinceLastVisitStrip, useSinceLastVisit } from './SinceLastVisitStrip'

/**
 * One notice at a time above the data (Predator's design pass: four text blocks stacked above the first number pushed it 1,900 px down a
 * phone). What changed since the last visit comes first; the backup reminder takes its place once that is hidden or there is nothing to say.
 */
export function TopNotice() {
  const since = useSinceLastVisit()
  if (since.visible) return <SinceLastVisitStrip summary={since.summary} onDismiss={since.dismiss} />
  return <BackupNudgeStrip />
}
