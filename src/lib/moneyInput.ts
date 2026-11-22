/** Parse what a person typed into a money box ("65,000", "$1 200.50", "") into a number. Unparseable → 0. */
export function parseMoney(text: string): number {
  const cleaned = text.replace(/[^0-9.]/g, '')
  const firstDot = cleaned.indexOf('.')
  const normal = firstDot === -1 ? cleaned : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
  const n = parseFloat(normal)
  return Number.isFinite(n) ? n : 0
}

/** Show a number with thousands separators while it is being typed; keeps a trailing "." and up to 2 decimals as typed. */
export function groupMoney(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '')
  if (cleaned === '') return ''
  const firstDot = cleaned.indexOf('.')
  const intPart = (firstDot === -1 ? cleaned : cleaned.slice(0, firstDot)).replace(/^0+(?=\d)/, '')
  const dec = firstDot === -1 ? null : cleaned.slice(firstDot + 1).replace(/\./g, '').slice(0, 2)
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return dec === null ? grouped : `${grouped || '0'}.${dec}`
}
