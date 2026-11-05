import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts (offline-safe; no Google Fonts network dependency).
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource/source-sans-3/400.css'
import '@fontsource/source-sans-3/600.css'
import './index.css'
import App from './App'
import { isNative } from './lib/native'
import { track } from './analytics'
import { startWhatsNew, wasHereBefore } from './whatsNew'

// read before App can write the intro flag on this load (whats-new: who is returning)
const returning = wasHereBefore()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// What's new: after first paint, once per version (never in a frame; see src/whatsNew.ts).
// Safari has no requestIdleCallback.
const later = window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1))
later(() => startWhatsNew({ track, returning }))

if (isNative) {
  // Native shell serves the bundle from disk — no service worker (it fights
  // capacitor://). Do the native boot (status bar, hide splash) instead.
  import('./lib/native-init').then(({ initNative }) => initNative())
} else if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
}
