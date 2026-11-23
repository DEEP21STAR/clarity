import { lazy, Suspense, useEffect, useState, type ComponentProps } from 'react'
import { whenBooted } from '@/lib/bootSignal'

// The animated backdrop pulls in Three.js (large). Every screen that wants it goes through this wrapper, so the library is
// fetched as a separate chunk only AFTER the intro has finished (its start-up would otherwise stall the splash animation);
// until then the screen simply shows its plain dark background.
const Impl = lazy(() => import('./AmbientBackground').then((m) => ({ default: m.AmbientBackground })))

export function AmbientBackground(props: ComponentProps<typeof Impl>) {
  const [ready, setReady] = useState(false)
  useEffect(() => whenBooted(() => setReady(true)), [])
  if (!ready) return null
  return <Suspense fallback={null}><Impl {...props} /></Suspense>
}
