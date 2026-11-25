import { BackupNudgeStrip } from './BackupNudgeStrip'
import { WhatsNewCard, useWhatsNew } from './WhatsNewCard'
import { SinceLastVisitStrip, useSinceLastVisit } from './SinceLastVisitStrip'

/**
 * One notice at a time above the data (Predator's design pass: four text blocks stacked above the first number pushed it 1,900 px down a
 * phone). What changed since the last visit comes first; the backup reminder takes its place once that is hidden or there is nothing to say.
 */
export function TopNotice() {
  const news = useWhatsNew()
  const since = useSinceLastVisit()
  if (news.visible) return <WhatsNewCard onDismiss={news.dismiss} />
  if (since.visible) return <SinceLastVisitStrip summary={since.summary} onDismiss={since.dismiss} />
  return <BackupNudgeStrip />
}
