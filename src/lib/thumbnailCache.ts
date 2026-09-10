// html2canvas-pro, not plain html2canvas — the original can't parse Tailwind v4's oklch/oklab
// color functions at all (confirmed live: it threw "Attempting to parse an unsupported color
// function 'oklab'" on every real capture attempt in this app, since Tailwind v4 emits oklch
// colors by default). html2canvas-pro is a maintained fork that adds oklch/oklab/lab/color-mix
// parsing — verified working via a real capture, not assumed from its README.
import html2canvas from 'html2canvas-pro'

/**
 * Round 21, item #3 — cached destination thumbnails for the ⌘K Quick Actions
 * hover preview.
 *
 * HONESTY NOTE (read this before assuming these are live): these are NOT a
 * live re-render of the destination on every hover. This is a client-only,
 * single-file artifact with no server/build-time rendering step available,
 * so a real live preview per hover would mean mounting a second, hidden copy
 * of each tab's full component tree (with its own store subscription, GSAP
 * timers, recharts instances) just to paint a thumbnail nobody clicks into —
 * expensive and fragile for zero real benefit over a cached snapshot that's
 * refreshed the moment the data it shows actually changes.
 *
 * What actually happens: the FIRST time a tab is genuinely visited in a
 * session, ~900ms after its entrance animation settles, the real rendered
 * DOM of that tab's <main> content is captured via html2canvas into a
 * downscaled JPEG data URL, cached in memory AND in localStorage (so it
 * survives a reload). Revisiting a tab later re-captures and overwrites the
 * cached image, so the thumbnail is only ever "stale" within a single visit
 * to that tab (the state at the moment it was last open), never frozen at
 * first-ever-launch forever. A tab never yet visited this browser has no
 * thumbnail at all — the hover preview says so honestly rather than showing
 * a placeholder that could be mistaken for real content.
 */

const MEM_CACHE = new Map<string, string>()
const STORAGE_PREFIX = 'clarity:thumb:'
const THUMB_WIDTH = 420

function storageKey(tabId: string) {
  return `${STORAGE_PREFIX}${tabId}`
}

export function getCachedThumbnail(tabId: string): string | null {
  if (MEM_CACHE.has(tabId)) return MEM_CACHE.get(tabId)!
  try {
    const stored = localStorage.getItem(storageKey(tabId))
    if (stored) {
      MEM_CACHE.set(tabId, stored)
      return stored
    }
  } catch {
    // localStorage unavailable (private mode, quota) — thumbnail just won't persist across reloads.
  }
  return null
}

let captureInFlight: Promise<void> | null = null

/**
 * Captures `el`'s current rendered DOM into a cached thumbnail for `tabId`.
 * Fire-and-forget from the caller's point of view — failures (e.g. a
 * cross-origin image inside the captured tree, or html2canvas simply not
 * coping with some CSS it doesn't support) are swallowed, since a missing
 * thumbnail degrades gracefully to the honest "no preview yet" state, never
 * a broken image.
 */
export async function captureThumbnail(tabId: string, el: HTMLElement): Promise<void> {
  // Serialize captures — html2canvas walking the live DOM while another capture is mid-flight
  // (e.g. a very fast double tab-switch) has caused occasional blank frames in testing.
  const run = async () => {
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: '#05060a',
        scale: 1,
        logging: false,
        // The ambient particle background is a WebGL canvas living outside <main> already, so
        // it's never in `el` — no ignoreElements needed for it. This DOES still exclude any
        // element explicitly opted out via data-thumbnail-skip (none currently, reserved for
        // future use e.g. a live video/webcam element that should never be snapshotted).
        ignoreElements: (node) => node.hasAttribute?.('data-thumbnail-skip') ?? false,
        // Real bug found via live capture, not assumed: <main> carries the page-enter-tilt
        // entrance animation's class, which sets `transform-style: preserve-3d` (paired with
        // the parent's `perspective`) — html2canvas-pro's layout engine doesn't implement real
        // 3D transforms and painted a completely blank frame with this class present, even
        // though by the time this capture fires (900ms after the tab switch, well past the
        // 450ms animation) it's fully settled and has zero remaining visual effect. Stripping
        // it here only mutates the throwaway clone html2canvas renders from — the live page
        // (and its next real entrance animation) is untouched.
        onclone: (clonedDoc: Document) => {
          clonedDoc.querySelectorAll('.page-enter').forEach((n) => n.classList.remove('page-enter'))
          // Second real gap found the same way (live capture, not assumed): `.gradient-heading`
          // uses background-clip:text + color:transparent, which html2canvas-pro doesn't
          // support — every gradient headline/label/emphasised figure rendered as invisible.
          // Swapping to a flat colour (the gradient's own cyan start stop) on the clone only
          // keeps every gradient-heading element legible in the capture without touching the
          // live page's real gradient rendering.
          clonedDoc.querySelectorAll<HTMLElement>('.gradient-heading').forEach((n) => {
            n.style.background = 'none'
            n.style.setProperty('-webkit-text-fill-color', '#67e8f9')
            n.style.color = '#67e8f9'
          })
        },
      })
      const scale = THUMB_WIDTH / canvas.width
      const out = document.createElement('canvas')
      out.width = THUMB_WIDTH
      out.height = Math.round(canvas.height * scale)
      const ctx = out.getContext('2d')
      if (!ctx) return
      ctx.drawImage(canvas, 0, 0, out.width, out.height)
      const dataUrl = out.toDataURL('image/jpeg', 0.72)
      MEM_CACHE.set(tabId, dataUrl)
      try {
        localStorage.setItem(storageKey(tabId), dataUrl)
      } catch {
        // Quota exceeded or unavailable — memory cache for this session still works.
      }
    } catch {
      // Swallowed by design — see doc comment above.
    }
  }
  captureInFlight = (captureInFlight ?? Promise.resolve()).then(run)
  return captureInFlight
}
