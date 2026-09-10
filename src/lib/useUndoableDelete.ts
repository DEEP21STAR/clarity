import { useStore } from './store'
import { useToast } from '@/components/Toast'

/**
 * #49 — the ONE reusable pattern every destructive delete in the app uses:
 * snapshot the full state, run the delete, show a toast with a real Undo
 * that restores the exact snapshot. Shared here so every delete button
 * doesn't hand-roll its own (partial, easy-to-miss-a-field) undo logic.
 */
export function useUndoableDelete() {
  const { state, restoreState } = useStore()
  const { showToast } = useToast()
  return function withUndo(message: string, action: () => void) {
    const snapshot = state
    action()
    showToast(message, { tone: 'info', actionLabel: 'Undo', onAction: () => restoreState(snapshot) })
  }
}
