import { cn, formatNumericDate } from '@/lib/utils'

/**
 * Real fix for a real regression Deep caught: the earlier date-format fix added a SECOND grey
 * DD/MM/YYYY caption underneath every native date input, so a field showed two different-
 * looking dates at once (the native input's own ambiguous MM/DD-shaped digits, controlled by
 * the browser's own OS/locale — confirmed unfixable via `lang` — plus a small correct caption
 * below it). Two dates on screen reads as a bug even though the value was always correct.
 *
 * Real fix: show exactly ONE date, always. The native `<input type="date">` stays — clicking
 * anywhere on it still opens the real OS/browser date picker and still fires real onChange —
 * but its own text is made invisible (`color: transparent`) rather than fought with `lang`.
 * `colorScheme: 'dark'` keeps the native calendar-picker icon visible and theme-appropriate
 * (it would otherwise render as a dark icon on this app's dark background). A single overlay
 * span, `pointer-events-none` so every click/tap passes straight through to the real input
 * beneath it, shows the one real DD/MM/YYYY text a person actually reads.
 */
export function DateField({
  value,
  onChange,
  inputClassName,
  wrapperClassName,
  overlayClassName,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  /** The exact classes the native input previously had (border/bg/padding/size) — kept so every field's existing box styling is unchanged. */
  inputClassName: string
  wrapperClassName?: string
  /** Padding/text-size for the overlay text — should match inputClassName's own padding so the single visible date lines up inside the same box. */
  overlayClassName?: string
  placeholder?: string
}) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClassName}
        style={{ colorScheme: 'dark', color: 'transparent' }}
      />
      <span
        className={cn(
          'absolute inset-y-0 left-0 flex items-center pointer-events-none tabular-nums',
          value ? 'text-white/85' : 'text-white/30',
          overlayClassName
        )}
      >
        {value ? formatNumericDate(value) : placeholder}
      </span>
    </div>
  )
}
