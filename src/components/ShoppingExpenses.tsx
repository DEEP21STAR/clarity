import { StatCard } from './StatCard'
import { Refrigerator } from 'lucide-react'

/**
 * Shopping & Expenses — the 3D fridge/pantry scene is explicitly OUT OF SCOPE tonight
 * ("forget about the fridge for now"). Honest placeholder shown instead of attempting
 * to reconstruct the Three.js scene from scratch.
 */
export function ShoppingExpenses() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="gradient-heading text-2xl font-bold tracking-tight">Shopping & Expenses</h2>
        <p className="text-sm text-white/50 mt-1">Grocery and household spend tracking.</p>
      </div>

      <StatCard label="3D Fridge & Pantry" glow="purple" tilt={false}>
        <div className="mt-6 flex flex-col items-center justify-center py-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-400/20 border border-purple-400/30 flex items-center justify-center mb-4">
            <Refrigerator className="w-8 h-8 text-purple-300" />
          </div>
          <p className="text-white/70 font-medium">3D fridge view — coming back soon</p>
          <p className="text-xs text-white/40 mt-2 max-w-sm">
            The interactive 3D fridge & pantry scene is set aside for now by request. This
            placeholder is honest about that rather than a rebuilt half-version — a real
            shopping list still works below.
          </p>
        </div>
      </StatCard>
    </div>
  )
}
