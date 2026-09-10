import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

/**
 * Segmented toggle with a real sliding highlight pill (CSS `left`/`width`
 * transition, not an instant snap) — shared by the household Deep/Mimi/
 * Combined toggle, the Upcoming Payments window toggle, the Budgets period
 * toggle, the Dashboard mode/country toggles, and the GST direction toggle.
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
  const idx = Math.max(0, options.findIndex((o) => o.value === value))
  const pct = 100 / options.length

  return (
    <div className={cn('segmented-track inline-flex rounded-full border border-white/10 p-0.5', size === 'sm' ? 'text-[10px]' : 'text-xs')}>
      <div
        className="segmented-thumb"
        style={{ left: `calc(${idx * pct}% + 2px)`, width: `calc(${pct}% - 4px)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative z-10 font-medium capitalize whitespace-nowrap',
            size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-1.5',
            value === o.value ? 'text-black' : 'text-white/50 hover:text-white'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
