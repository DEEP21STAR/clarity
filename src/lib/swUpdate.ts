/**
 * Keeps an installed copy of the app from going stale.
 * A deploy only reaches an open or reloaded page after the browser installs the new service worker in the background, so a normal
 * reload can keep serving the previous version (and its missing features) once more. Here the page asks for updates when it comes back
 * into view and every half hour, and reloads itself once when a new worker takes over, unless you are typing in a field (then right after).
 */
const RELOAD_STAMP = 'clarity-sw-reload-at'

export function isEditing(el: Element | null): boolean {
  const tag = el?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement | null)?.isContentEditable === true
}

/** Never reload twice within 15 seconds (guards against any reload loop). */
export function reloadAllowed(now: number, lastStamp: string | null): boolean {
  const last = Number(lastStamp)
  return !Number.isFinite(last) || last <= 0 || now - last > 15_000
}

export function startSwUpdates(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const sw = navigator.serviceWorker
  let controller = sw.controller // null on a first-ever visit: the first worker taking over then also fires controllerchange, which must not reload
  let reloading = false

  const reloadNow = () => {
    let stamp: string | null = null
    try { stamp = sessionStorage.getItem(RELOAD_STAMP) } catch { /* ignore */ }
    if (!reloadAllowed(Date.now(), stamp)) return
    try { sessionStorage.setItem(RELOAD_STAMP, String(Date.now())) } catch { /* ignore */ }
    location.reload()
  }

  sw.addEventListener('controllerchange', () => {
    const firstInstall = controller === null
    controller = sw.controller
    if (firstInstall || reloading) return
    reloading = true
    if (isEditing(document.activeElement)) addEventListener('focusout', reloadNow, { once: true })
    else reloadNow()
  })

  const check = () => { sw.getRegistration().then((r) => r?.update()).catch(() => { /* offline or blocked: try again later */ }) }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check() })
  setInterval(check, 30 * 60 * 1000)
}
