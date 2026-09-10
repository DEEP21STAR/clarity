import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getCachedThumbnail, captureThumbnail } from '@/lib/thumbnailCache'

const STAGGER_MS = 400
// Shorter than the 900ms on-visit capture in App.tsx — these mounts never actually go through
// the real page-enter-3d tab-switch transition (they're rendered off-screen, never displayed),
// so there's no entrance animation to wait out, just each tab's own StatCard GSAP fly-ins
// (0.7s duration + up to ~0.1s stagger delay) settling.
const SETTLE_MS = 900

/**
 * Coordinator follow-up fix, verified live: the hover-preview mechanism itself worked
 * correctly, but only cached a tab's thumbnail AFTER a real visit — so a first-time ⌘K open
 * legitimately showed "No preview yet" for every tab except whichever one happened to load
 * first. This mounts each NOT-YET-CACHED tab's real component off-screen (real layout, real
 * paint — not display:none/visibility:hidden, which html2canvas can't capture reliably),
 * waits for it to visually settle, captures it via the same real captureThumbnail() pipeline
 * as an on-visit capture, unmounts it, and moves to the next — one at a time, staggered, so
 * boot never jank. Still real, still cached (not live) — see thumbnailCache.ts's doc comment
 * for the full honesty note; this only changes WHEN the cache gets warmed, not what it is.
 */
export function ThumbnailPrecacher({
  tabIds,
  skipId,
  renderTab,
}: {
  tabIds: string[]
  /** The tab already visible right now — App.tsx's own on-visit capture effect handles it; precaching it too would just be a redundant, wasted duplicate capture. */
  skipId: string
  renderTab: (id: string) => ReactNode
}) {
  const queue = tabIds.filter((id) => id !== skipId)
  const [index, setIndex] = useState(0)
  const hostRef = useRef<HTMLDivElement>(null)
  const currentId = queue[index]

  // Skip any tab that already has a real cached thumbnail — from an earlier real visit this
  // session, or a prior session's localStorage — so this never re-captures work already done.
  useEffect(() => {
    if (index >= queue.length) return
    if (getCachedThumbnail(queue[index])) setIndex((i) => i + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  useEffect(() => {
    if (!currentId || !hostRef.current) return
    const el = hostRef.current
    const settleTimer = window.setTimeout(() => {
      captureThumbnail(currentId, el).finally(() => {
        window.setTimeout(() => setIndex((i) => i + 1), STAGGER_MS)
      })
    }, SETTLE_MS)
    return () => window.clearTimeout(settleTimer)
  }, [currentId])

  if (!currentId) return null

  return (
    <div style={{ position: 'fixed', top: 0, left: -99999, width: 1152, pointerEvents: 'none' }} aria-hidden="true">
      <div ref={hostRef} className="max-w-6xl mx-auto px-4 py-8">
        {renderTab(currentId)}
      </div>
    </div>
  )
}
