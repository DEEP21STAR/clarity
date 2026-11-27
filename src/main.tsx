import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lightTheme.generated.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { startSwUpdates } from './lib/swUpdate'

// A page that stays up for a while has loaded fine: allow a later update to retry its automatic reload again.
setTimeout(() => { try { sessionStorage.removeItem('clarity-chunk-retry') } catch { /* ignore */ } }, 20_000)

startSwUpdates()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
