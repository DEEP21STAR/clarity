import { useEffect, useState } from 'react'
import { groupMoney, parseMoney } from '@/lib/moneyInput'

/** Money box that groups thousands as you type ("65,000") and keeps a half-typed "1200." intact. */
export function MoneyField({ value, onChange, label, className }: { value: number; onChange: (n: number) => void; label: string; className?: string }) {
  const [draft, setDraft] = useState(() => groupMoney(String(value)))
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setDraft(groupMoney(String(value))) }, [value, focused])
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={draft}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => { const g = groupMoney(e.target.value); setDraft(g); onChange(parseMoney(g)) }}
      className={className}
    />
  )
}
