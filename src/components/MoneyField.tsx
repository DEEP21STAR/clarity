import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { caretAfterDigits, digitsBeforeCaret, groupMoney, parseMoney } from '@/lib/moneyInput'

/** Money box that groups thousands as you type ("65,000") and keeps a half-typed "1200." intact. */
export function MoneyField({ value, onChange, label, className }: { value: number; onChange: (n: number) => void; label: string; className?: string }) {
  const [draft, setDraft] = useState(() => groupMoney(String(value)))
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const caretDigits = useRef<number | null>(null)
  // Reformatting a controlled input moves the caret to the end; put it back after the same number of digits.
  useLayoutEffect(() => {
    if (caretDigits.current === null || !inputRef.current) return
    const pos = caretAfterDigits(draft, caretDigits.current)
    caretDigits.current = null
    inputRef.current.setSelectionRange(pos, pos)
  }, [draft])
  useEffect(() => { if (!focused) setDraft(groupMoney(String(value))) }, [value, focused])
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={draft}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const g = groupMoney(e.target.value)
        caretDigits.current = digitsBeforeCaret(e.target.value, e.target.selectionStart ?? e.target.value.length)
        setDraft(g)
        onChange(parseMoney(g))
      }}
      className={className}
    />
  )
}
