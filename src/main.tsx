import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppV2 as App } from './v2/AppV2'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initInstallCapture } from './lib/install'
import { initStateMirror } from './lib/native/stateMirror'
import { initNativeNotifications } from './lib/native/notifications'
import { initBackButton } from './lib/native/backButton'
import './styles/globals.css'  // rebuild "Precision × Accessible" (Tailwind + tokens)

// Captura el evento beforeinstallprompt ANTES de montar React (se dispara muy temprano).
initInstallCapture()

// Arranque: en NATIVO (Capacitor) hay que restaurar el espejo de estado ANTES de que el
// provider lea localStorage en su primer render — por eso el await previo a render().
// En web/PWA los tres init son no-op inmediatos: el arranque del beta no cambia.
async function boot(): Promise<void> {
  try {
    await initStateMirror()
  } catch {
    /* el espejo NUNCA bloquea el arranque */
  }
  void initNativeNotifications()
  void initBackButton()

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary allowReset scope="root">
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )
}

void boot()
