/** A tiny "the intro has finished" signal, so heavy decorative work (the 3D backdrop) can wait until the splash is done instead of competing with its animation. */
let booted = false
const listeners = new Set<() => void>()

export function markBooted() {
  if (booted) return
  booted = true
  listeners.forEach((l) => l())
  listeners.clear()
}

/** Calls `cb` once the intro has finished (immediately if it already has). Returns a cancel function. */
export function whenBooted(cb: () => void): () => void {
  if (booted) { cb(); return () => {} }
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

/** For tests. */
export function resetBootSignal() { booted = false; listeners.clear() }
