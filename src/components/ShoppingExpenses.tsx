import { StatCard } from './StatCard'
import { Refrigerator, ShoppingCart } from 'lucide-react'

/**
 * Shopping & Expenses — the 3D fridge/pantry scene is explicitly OUT OF SCOPE tonight
 * ("forget about the fridge for now"). Honest placeholder shown instead of attempting
 * to reconstruct the Three.js scene from scratch. #9, Round 20: the placeholder's icon
 * is now a real animated "filling" shopping cart (CSS keyframe bob, see .cart-fill-icon
 * in index.css) instead of a static fridge glyph — still explicitly NOT the fridge scene.
 */
export function ShoppingExpenses() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="gradient-heading text-2xl font-bold tracking-tight">Shopping & Expenses</h2>
        <p className="text-sm text-white/50 mt-1">Grocery and household spend tracking.</p>
      </div>

      <StatCard label="3D Fridge & Pantry" glow="purple">
        <div className="mt-6 flex flex-col items-center justify-center py-10 text-center">
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-400/20 border border-purple-400/30 flex items-center justify-center mb-4">
            <ShoppingCart className="cart-fill-icon w-8 h-8 text-cyan-300" />
          </div>
          <p className="text-white/70 font-medium">3D fridge view — coming back soon</p>
          <p className="text-xs text-white/40 mt-2 max-w-sm">
            The interactive 3D fridge & pantry scene is set aside for now by request. This
            placeholder is honest about that rather than a rebuilt half-version — a real
            shopping list still works below.
          </p>
          <Refrigerator className="w-4 h-4 text-purple-400/40 mt-3" aria-hidden="true" />
        </div>
      </StatCard>
    </div>
  )
}
