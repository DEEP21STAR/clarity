/** Shown for the instant a lazily loaded tab is still arriving: the same glass cards, softly pulsing (static under reduced motion). */
export function TabSkeleton() {
  const card = 'rounded-2xl border border-white/10 bg-white/[0.04] motion-safe:animate-pulse'
  return (
    <div role="status" aria-busy="true" aria-label="Loading this tab" className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-56 rounded-lg bg-white/10 motion-safe:animate-pulse" />
        <div className="h-4 w-80 max-w-full rounded bg-white/[0.07] motion-safe:animate-pulse" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className={`${card} h-32`} />)}
      </div>
      <div className={`${card} h-64`} />
    </div>
  )
}
