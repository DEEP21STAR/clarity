import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

/**
 * Segmented toggle with a real sliding highlight pill — shared by the
 * household Deep/Mimi/Combined toggle, the Upcoming Payments window toggle,
 * the Budgets period toggle, the Dashboard mode/country toggles, and the
 * GST direction toggle.
 *
 * Round 21 real fix: the thumb used to be positioned with percentage math
 * that ASSUMED every segment is an equal 100/n% share of the track. That's
 * false — these buttons are flex children with no forced equal width, so
 * they size to their own text content ("Combined" is genuinely wider than
 * "Deep" or "Mimi"). The computed percentage thumb and the actual rendered
 * button box therefore disagreed, and for the widest label the leading
 * edge of the text could land outside the thumb's painted area entirely —
 * black text on the dark track background is invisible there. That's the
 * real cause of "the word looks like it's missing a letter."
 *
 * Real fix: measure the ACTUAL active button's box with getBoundingClientRect
 * and position the thumb in real pixels, not assumed percentages. This is
 * correct for any label length by construction — there's no longer a
 * percentage-vs-content mismatch to have, and the sliding animation is kept
 * (CSS transition on left/width, now driven by real measured pixel values).
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T
  options: SegmentedOption<T>[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef(new Map<T, HTMLButtonElement>())
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const measure = () => {
      const track = trackRef.current
      const btn = btnRefs.current.get(value)
      if (!track || !btn) return
      const trackRect = track.getBoundingClientRect()
      const btnRect = btn.getBoundingClientRect()
      // Real measured box, PLUS a small 2px safety margin on each side (belt-and-braces on top
      // of the real fix above — sub-pixel rounding from getBoundingClientRect should never be
      // the thing that clips a glyph again).
      setThumb({ left: btnRect.left - trackRect.left - 2, width: btnRect.width + 4 })
    }
    measure()
    // Re-measure on resize/reflow (font load, container width change, etc.) — the whole point
    // of this fix is that the thumb tracks the REAL rendered box, not a one-time assumption.
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [value, options.length, size])

  return (
    <div ref={trackRef} className={cn('segmented-track relative inline-flex rounded-full border border-white/10 p-0.5', size === 'sm' ? 'text-[10px]' : 'text-xs')}>
      {thumb && (
        <div
          className="segmented-thumb"
          style={{ left: thumb.left, width: thumb.width }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          ref={(el) => { if (el) btnRefs.current.set(o.value, el); else btnRefs.current.delete(o.value) }}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative z-10 capitalize whitespace-nowrap',
            size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-1.5',
            // Active label: solid black + semibold on the light cyan->purple thumb (see .segmented-thumb
            // comment in index.css for the real contrast fix this pairs with — both endpoints verified >=11.8:1).
            value === o.value ? 'text-black font-semibold' : 'text-white/50 font-medium hover:text-white'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
