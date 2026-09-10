import { Sun, Cloud, CloudLightning } from 'lucide-react'

/** Financial-weather mood icon — sunny (healthy score) → cloudy (tight) → stormy (overextended), each gently animated via CSS keyframes in index.css. */
export function MoodIcon({ score, size = 40 }: { score: number; size?: number }) {
  if (score >= 75) {
    return (
      <div className="shrink-0 mood-sunny" style={{ width: size, height: size }}>
        <Sun className="w-full h-full text-amber-300" />
      </div>
    )
  }
  if (score >= 40) {
    return (
      <div className="shrink-0 mood-cloudy" style={{ width: size, height: size }}>
        <Cloud className="w-full h-full text-cyan-300" />
      </div>
    )
  }
  return (
    <div className="shrink-0 mood-stormy" style={{ width: size, height: size }}>
      <CloudLightning className="w-full h-full text-rose-400" />
    </div>
  )
}
