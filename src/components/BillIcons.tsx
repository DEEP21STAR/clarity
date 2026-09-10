import { Flame, Zap, ShieldCheck, Cloud, Droplet, Home, CreditCard, Smartphone } from 'lucide-react'

/**
 * Small animated per-bill-category icons (CSS keyframes in index.css, not a
 * heavy animation-file format). Matched by bill name via a loose keyword
 * lookup so any bill named "Gas", "Electricity", etc gets the right icon —
 * falls back to a plain, un-animated dot for anything unrecognised.
 */
export function BillIcon({ name, className = 'w-4 h-4' }: { name: string; className?: string }) {
  const n = name.toLowerCase()

  if (n.includes('gas')) return <Flame className={`${className} icon-gas text-amber-400`} />
  if (n.includes('electric')) return <Zap className={`${className} icon-electricity text-yellow-300`} />
  if (n.includes('internet') || n.includes('mobile') || n.includes('telstra')) return <SignalBars className={className} />
  if (n.includes('gem visa') || n.includes('visa')) return <CreditCard className={`${className} icon-card-tilt text-purple-300`} />
  if (n.includes('hsbc')) return <ShieldCheck className={`${className} icon-shield text-cyan-300`} />
  if (n.includes('spotify')) return <EqBars className={className} />
  if (n.includes('google')) return <Cloud className={`${className} icon-cloud text-blue-300`} />
  if (n.includes('water')) return (
    <span className="icon-water-wrap">
      <Droplet className={`${className} icon-water-droplet text-cyan-300`} />
    </span>
  )
  if (n.includes('rent')) return <Home className={`${className} icon-home text-purple-300`} />
  if (n.includes('insurance')) return <ShieldCheck className={`${className} icon-shield text-emerald-300`} />
  if (n.includes('fold') || n.includes('galaxy') || n.includes('phone')) return <Smartphone className={`${className} icon-fold text-cyan-200`} />
  return <span className={`${className} inline-block rounded-full bg-white/20`} />
}

function SignalBars({ className }: { className: string }) {
  return (
    <span className={`inline-flex items-end gap-0.5 ${className}`} style={{ height: '1em' }}>
      {[0.4, 0.6, 0.8, 1].map((h, i) => (
        <span
          key={i}
          className="icon-signal-bar bg-cyan-300 rounded-sm"
          style={{ width: '2px', height: `${h * 100}%` }}
        />
      ))}
    </span>
  )
}

function EqBars({ className }: { className: string }) {
  return (
    <span className={`inline-flex items-end gap-0.5 ${className}`} style={{ height: '1em' }}>
      {[1, 2, 3].map((i) => (
        <span key={i} className="icon-eq-bar bg-emerald-400 rounded-sm" style={{ width: '3px', height: '100%' }} />
      ))}
    </span>
  )
}
